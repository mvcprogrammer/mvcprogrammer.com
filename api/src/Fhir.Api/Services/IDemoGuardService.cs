using Fhir.Api.Fhir;
using Fhir.Api.Models;
using Hl7.Fhir.Model;

namespace Fhir.Api.Services;

/// <summary>
/// The demo guard every write runs first: the seeded patient is read-only, and a session may only
/// touch a patient it created. Shared by the patient and condition writes so the rule lives once.
/// </summary>
public interface IDemoGuardService
{
    /// <summary>
    /// Reads the patient and checks it is this session's. The seeded patient throws
    /// <see cref="DemoPatientReadOnlyException"/>. A patient the sandbox reports gone returns null.
    /// A patient that exists but does not carry this session's token, or does not exist at all,
    /// throws <see cref="WritablePatientNotFoundException"/>, so the explorer cannot probe other records.
    /// </summary>
    Task<Patient?> OwnedPatientAsync(string patientId, string sessionToken, TraceBuilder trace, CancellationToken cancellationToken);
}
