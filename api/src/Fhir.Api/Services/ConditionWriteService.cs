using Fhir.Api.Configuration;
using Fhir.Api.Fhir;
using Fhir.Api.Mapping;
using Fhir.Api.Models;
using Hl7.Fhir.Model;
using Microsoft.Extensions.Options;
using Task = System.Threading.Tasks.Task;

namespace Fhir.Api.Services;

/// <summary>
/// The add, in order: the code must be on the pick list (no upstream call is spent on one that is
/// not), the patient must be this session's, the patient must have room under the active cap, and
/// then a conditional create on patient, code, and active status so a repeat returns the condition
/// already there. The resolve: the patient must be this session's, the condition must exist and
/// reference it, and then one update unless it is already resolved. Nothing is kept in the function.
/// </summary>
public sealed class ConditionWriteService : IConditionWriteService
{
    private readonly IFhirGateway _gateway;
    private readonly IDemoGuardService _guard;
    private readonly FhirOptions _options;
    private readonly TimeProvider _time;

    public ConditionWriteService(IFhirGateway gateway, IDemoGuardService guard, IOptions<FhirOptions> options, TimeProvider time)
    {
        ArgumentNullException.ThrowIfNull(gateway);
        ArgumentNullException.ThrowIfNull(guard);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(time);
        _gateway = gateway;
        _guard = guard;
        _options = options.Value;
        _time = time;
    }

    public async Task<(ConditionWriteResult Result, bool Created)> AddAsync(string patientId, ConditionInput input, string sessionToken, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);
        ArgumentNullException.ThrowIfNull(input);
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionToken);

        var entry = ConditionPickList.Find(input.Code)
            ?? throw new ConditionRejectedException(
                ConditionRejection.OffPickList,
                $"Code '{input.Code}' is not on the pick list; send one of the {ConditionPickList.All.Count} SNOMED CT codes the operation documents.");

        var trace = new TraceBuilder(new DataSource(_options.SourceName, _options.BaseUrl.ToString().TrimEnd('/')), _options.PageCap);
        _ = await _guard.OwnedPatientAsync(patientId, sessionToken, trace, cancellationToken)
            ?? throw new WritablePatientNotFoundException(patientId);

        var active = await _gateway.CountAsync<Condition>(ConditionInputMapper.ActiveConditionsQuery(patientId), trace, cancellationToken);
        if (active >= _options.MaxActiveConditionsPerPatient)
        {
            throw new ConditionRejectedException(
                ConditionRejection.ActiveCapReached,
                $"Patient '{patientId}' already has {_options.MaxActiveConditionsPerPatient} active conditions; resolve one before adding another.");
        }

        var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);
        var condition = ConditionInputMapper.ToNewCondition(entry, patientId, today);
        var stored = await _gateway.CreateAsync(condition, ConditionInputMapper.ExistingActiveQuery(patientId, entry), trace, cancellationToken);
        return (new ConditionWriteResult(ConditionMapper.ToItem(stored.Resource), trace.Build()), stored.Created);
    }

    public async Task ResolveAsync(string patientId, string conditionId, string sessionToken, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);
        ArgumentException.ThrowIfNullOrWhiteSpace(conditionId);
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionToken);

        var trace = new TraceBuilder(new DataSource(_options.SourceName, _options.BaseUrl.ToString().TrimEnd('/')), _options.PageCap);
        _ = await _guard.OwnedPatientAsync(patientId, sessionToken, trace, cancellationToken)
            ?? throw new WritablePatientNotFoundException(patientId);

        Condition stored;
        try
        {
            stored = await _gateway.ReadAsync<Condition>(conditionId, trace, cancellationToken);
        }
        catch (UpstreamNotFoundException)
        {
            // Missing and wiped alike: there is nothing to resolve, and the answer must not say which.
            throw new WritableConditionNotFoundException(patientId, conditionId);
        }

        if (!ConditionInputMapper.References(stored, patientId))
        {
            throw new WritableConditionNotFoundException(patientId, conditionId);
        }

        if (ConditionMapper.ClinicalStatusOf(stored) == ConditionInputMapper.RESOLVED)
        {
            // Already the end state the caller asks for: idempotent, and the sandbox is not written.
            return;
        }

        var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);
        await _gateway.UpdateAsync(ConditionInputMapper.ToResolved(stored, today), trace, cancellationToken);
    }
}
