using Fhir.Api.Fhir;
using Fhir.Api.Models;
using Hl7.Fhir.Model;

namespace Fhir.Api.Services;

/// <summary>
/// The demo guard every write runs first: the seeded patient is read-only, a session may only change
/// a patient it created, and it may add or resolve conditions on those and on the patients the HL7 ETL
/// loaded. Shared by the patient and condition writes so the rules live once.
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

    /// <summary>
    /// Reads the patient and checks this session may write conditions on it: it is this session's, or
    /// it carries an identifier in the cohort system (the HL7 ETL loaded it). The seeded patient throws
    /// <see cref="DemoPatientReadOnlyException"/>. A patient the sandbox reports gone returns null.
    /// Any other patient, or none, throws <see cref="WritablePatientNotFoundException"/>.
    /// </summary>
    Task<Patient?> ConditionWritablePatientAsync(string patientId, string sessionToken, TraceBuilder trace, CancellationToken cancellationToken);
}
