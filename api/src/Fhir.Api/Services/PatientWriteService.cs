using Fhir.Api.Configuration;
using Fhir.Api.Fhir;
using Fhir.Api.Mapping;
using Fhir.Api.Models;
using Hl7.Fhir.Model;
using Hl7.Fhir.Rest;
using Microsoft.Extensions.Options;
using Task = System.Threading.Tasks.Task;

namespace Fhir.Api.Services;

/// <summary>
/// The orchestration for the patient writes. Every change to an existing patient runs the demo
/// guard first (<see cref="IDemoGuardService"/>), which reads it and checks the session identifier;
/// a create counts the session's patients first; a delete removes the patient's conditions first,
/// since the sandbox refuses to delete a patient a condition still references. Nothing is kept in
/// the function: the guard reads the resource it is about to change, and the sandbox enforces
/// idempotency through the conditional create.
/// </summary>
public sealed class PatientWriteService : IPatientWriteService
{
    private readonly IFhirGateway _gateway;
    private readonly IDemoGuardService _guard;
    private readonly FhirOptions _options;
    private readonly TimeProvider _time;

    public PatientWriteService(IFhirGateway gateway, IDemoGuardService guard, IOptions<FhirOptions> options, TimeProvider time)
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

    public async Task<(PatientWriteResult Result, bool Created)> CreateAsync(PatientInput input, string sessionToken, string idempotencyKey, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionToken);
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);
        ThrowIfInvalid(input);

        var trace = NewTrace();
        var created = await _gateway.CountAsync<Patient>(
            new SearchParams().Add("identifier", DemoIdentifiers.Token(DemoIdentifiers.SESSION_SYSTEM, sessionToken)),
            trace,
            cancellationToken);
        if (created >= _options.MaxPatientsPerSession)
        {
            throw new SessionCapExceededException(_options.MaxPatientsPerSession);
        }

        var patient = PatientInputMapper.ToNewPatient(input, sessionToken, idempotencyKey);
        var ifNoneExist = new SearchParams().Add("identifier", DemoIdentifiers.Token(DemoIdentifiers.IDEMPOTENCY_SYSTEM, idempotencyKey));
        var stored = await _gateway.CreateAsync(patient, ifNoneExist, trace, cancellationToken);
        return (Result(stored.Resource, trace), stored.Created);
    }

    public async Task<PatientWriteResult> ReplaceAsync(string patientId, PatientInput input, string sessionToken, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);
        ArgumentNullException.ThrowIfNull(input);
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionToken);
        ThrowIfInvalid(input);

        var trace = NewTrace();
        var stored = await _guard.OwnedPatientAsync(patientId, sessionToken, trace, cancellationToken)
            ?? throw new WritablePatientNotFoundException(patientId);
        var updated = await _gateway.UpdateAsync(PatientInputMapper.ToReplacement(stored, input), trace, cancellationToken);
        return Result(updated, trace);
    }

    public async Task<PatientWriteResult> PatchAsync(string patientId, IReadOnlyList<PatientPatchOperation> operations, string sessionToken, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);
        ArgumentNullException.ThrowIfNull(operations);
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionToken);

        var trace = NewTrace();
        var stored = await _guard.OwnedPatientAsync(patientId, sessionToken, trace, cancellationToken)
            ?? throw new WritablePatientNotFoundException(patientId);
        var patched = PatientPatchApplier.Apply(PatientInputMapper.ToInput(stored), operations);
        ThrowIfInvalid(patched);
        var updated = await _gateway.UpdateAsync(PatientInputMapper.ToReplacement(stored, patched), trace, cancellationToken);
        return Result(updated, trace);
    }

    public async Task DeleteAsync(string patientId, string sessionToken, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionToken);

        var trace = NewTrace();
        var stored = await _guard.OwnedPatientAsync(patientId, sessionToken, trace, cancellationToken);
        if (stored is null)
        {
            // Gone: a patient this session (or the sandbox wipe) already removed. The state a delete asks for.
            return;
        }

        // The cascade. Conditions are the only resource the explorer writes against a session-created
        // patient, and the sandbox enforces referential integrity (409) while one remains. Each delete
        // tolerates a condition already gone, so a retry after a partial failure finishes the job.
        var conditions = await _gateway.SearchAsync<Condition>(
            ConditionInputMapper.ConditionsOfPatientQuery(patientId).LimitTo(_options.ConditionPageSize),
            _options.PageCap,
            trace,
            cancellationToken);
        foreach (var conditionId in conditions.Resources.Select(c => c.Id).OfType<string>().Where(id => id.Length > 0))
        {
            await _gateway.DeleteAsync<Condition>(conditionId, trace, cancellationToken);
        }

        await _gateway.DeleteAsync<Patient>(patientId, trace, cancellationToken);
    }

    private void ThrowIfInvalid(PatientInput input)
    {
        var errors = PatientInputValidator.Validate(input, Today);
        if (errors.Count > 0)
        {
            throw new PatientValidationException(errors);
        }
    }

    private DateOnly Today => DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);

    private PatientWriteResult Result(Patient patient, TraceBuilder trace) =>
        new(PatientMapper.ToDemographics(patient, Today), trace.Build());

    private TraceBuilder NewTrace() =>
        new(new DataSource(_options.SourceName, _options.BaseUrl.ToString().TrimEnd('/')), _options.PageCap);
}
