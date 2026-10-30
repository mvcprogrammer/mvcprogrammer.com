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

    public async Task<Patient?> OwnedPatientAsync(string patientId, string sessionToken, TraceBuilder trace, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionToken);
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
            throw new WritablePatientNotFoundException(patientId);
        }

        return string.Equals(PatientInputMapper.SessionTokenOf(stored), sessionToken, StringComparison.Ordinal)
            ? stored
            : throw new WritablePatientNotFoundException(patientId);
    }
}
