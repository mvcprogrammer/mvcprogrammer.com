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
/// The guard and the orchestration for the writes. Every change to an existing patient reads it
/// first and checks the session identifier; a create counts the session's patients first. Nothing
/// is kept in the function: the guard reads the resource it is about to change, and the sandbox
/// enforces idempotency through the conditional create.
/// </summary>
public sealed class PatientWriteService : IPatientWriteService
{
    private readonly IFhirGateway _gateway;
    private readonly FhirOptions _options;
    private readonly TimeProvider _time;

    public PatientWriteService(IFhirGateway gateway, IOptions<FhirOptions> options, TimeProvider time)
    {
        ArgumentNullException.ThrowIfNull(gateway);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(time);
        _gateway = gateway;
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
        var stored = await GuardAsync(patientId, sessionToken, trace, cancellationToken)
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
        var stored = await GuardAsync(patientId, sessionToken, trace, cancellationToken)
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
        var stored = await GuardAsync(patientId, sessionToken, trace, cancellationToken);
        if (stored is null)
        {
            // Gone: a patient this session (or the sandbox wipe) already removed. The state a delete asks for.
            return;
        }

        await _gateway.DeleteAsync<Patient>(patientId, trace, cancellationToken);
    }

    /// <summary>
    /// The guard. The seeded patient answers 403. A patient the sandbox reports gone returns null.
    /// A patient that exists but does not carry this session's token, or does not exist at all,
    /// answers 404 through the same exception, so the explorer cannot probe other records.
    /// </summary>
    private async Task<Patient?> GuardAsync(string patientId, string sessionToken, TraceBuilder trace, CancellationToken cancellationToken)
    {
        if (string.Equals(patientId, _options.SeedPatientId, StringComparison.Ordinal))
        {
            throw new DemoPatientReadOnlyException(patientId);
        }

        Patient stored;
        try
        {
            stored = await _gateway.ReadAsync<Patient>(patientId, trace, cancellationToken);
        }
        catch (UpstreamNotFoundException ex) when (ex.Gone)
        {
            return null;
        }
        catch (UpstreamNotFoundException)
        {
            throw new WritablePatientNotFoundException(patientId);
        }

        return string.Equals(PatientInputMapper.SessionTokenOf(stored), sessionToken, StringComparison.Ordinal)
            ? stored
            : throw new WritablePatientNotFoundException(patientId);
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
