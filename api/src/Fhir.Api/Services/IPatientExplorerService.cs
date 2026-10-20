using Fhir.Api.Models;
using Hl7.Fhir.Model;

namespace Fhir.Api.Services;

/// <summary>The three patient operations behind the endpoints. Validation of the inputs happens in the endpoints; the service trusts them.</summary>
public interface IPatientExplorerService
{
    Task<PatientSearchResult> SearchAsync(string family, string? birthdate, string? identifier, CancellationToken cancellationToken);

    Task<PatientSummary> SummaryAsync(string patientId, CancellationToken cancellationToken);

    /// <summary>The resources a summary is built from, as one Bundle of type collection, Patient first.</summary>
    Task<Bundle> RawAsync(string patientId, CancellationToken cancellationToken);
}
