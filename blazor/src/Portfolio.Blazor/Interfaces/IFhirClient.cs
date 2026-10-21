using Portfolio.Blazor.Models;
using Portfolio.Blazor.Requests;

namespace Portfolio.Blazor.Interfaces;

/// <summary>
/// Reads the FHIR API behind the patient explorer. Every method returns the body and the response
/// facts the explorer's log reports, and throws <see cref="Exceptions.FhirProblemException"/> on failure.
/// </summary>
public interface IFhirClient
{
    /// <summary>GET /api/fhir/patients?family=&amp;birthdate=&amp;identifier=: one page of matches.</summary>
    /// <param name="request">The search.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    Task<FhirResponse<PatientSearchResult>> SearchPatientsAsync(PatientSearchRequest request, CancellationToken cancellationToken);

    /// <summary>GET /api/fhir/patients/{id}/summary: demographics, counts, conditions, vitals, and the upstream trace.</summary>
    /// <param name="patientId">FHIR logical id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    Task<FhirResponse<PatientSummary>> GetSummaryAsync(string patientId, CancellationToken cancellationToken);

    /// <summary>GET /api/fhir/patients/{id}/raw: the FHIR bundle behind a summary, pretty-printed, as text.</summary>
    /// <param name="patientId">FHIR logical id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    Task<FhirResponse<string>> GetRawBundleAsync(string patientId, CancellationToken cancellationToken);

    /// <summary>GET /api/fhir/capability: what the sandbox supports of what the explorer needs.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    Task<FhirResponse<CapabilitySubset>> GetCapabilityAsync(CancellationToken cancellationToken);
}
