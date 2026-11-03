using Fhir.Api.Configuration;
using Fhir.Api.Fhir;
using Fhir.Api.Mapping;
using Fhir.Api.Models;
using Hl7.Fhir.Model;
using Microsoft.Extensions.Options;

namespace Fhir.Api.Services;

/// <inheritdoc cref="IDemoGuardService"/>
public sealed class DemoGuardService : IDemoGuardService
{
    private readonly IFhirGateway _gateway;
    private readonly FhirOptions _options;

    public DemoGuardService(IFhirGateway gateway, IOptions<FhirOptions> options)
    {
        ArgumentNullException.ThrowIfNull(gateway);
        ArgumentNullException.ThrowIfNull(options);
        _gateway = gateway;
        _options = options.Value;
    }

    public Task<Patient?> OwnedPatientAsync(string patientId, string sessionToken, TraceBuilder trace, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionToken);
        return ReadForWriteAsync(patientId, trace, stored => IsOwned(stored, sessionToken), () => new WritablePatientNotFoundException(patientId), cancellationToken);
    }

    public Task<Patient?> ConditionWritablePatientAsync(string patientId, string sessionToken, TraceBuilder trace, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionToken);
        return ReadForWriteAsync(patientId, trace, stored => IsOwned(stored, sessionToken) || IsInCohort(stored), () => WritablePatientNotFoundException.ForConditions(patientId), cancellationToken);
    }

    private static bool IsOwned(Patient stored, string sessionToken) =>
        string.Equals(PatientInputMapper.SessionTokenOf(stored), sessionToken, StringComparison.Ordinal);

    /// <summary>True when the patient carries an identifier in the cohort system, which only the HL7 ETL writes.</summary>
    private bool IsInCohort(Patient stored) =>
        stored.Identifier.Any(i => string.Equals(i.System, _options.CohortIdentifierSystem, StringComparison.Ordinal) && !string.IsNullOrWhiteSpace(i.Value));

    /// <summary>The shared shape: seed is 403, gone is null, missing or not permitted is the same 404 (so nothing can be probed).</summary>
    private async Task<Patient?> ReadForWriteAsync(
        string patientId,
        TraceBuilder trace,
        Func<Patient, bool> permitted,
        Func<WritablePatientNotFoundException> notFound,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);
        ArgumentNullException.ThrowIfNull(trace);

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
            throw notFound();
        }

        return permitted(stored) ? stored : throw notFound();
    }
}
