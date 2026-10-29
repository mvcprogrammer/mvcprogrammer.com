using Fhir.Api.Models;

namespace Fhir.Api.Services;

/// <summary>
/// The four write operations behind the endpoints, each under the demo guard: the seeded patient is
/// read-only, and a session may only change what it created. Header and body validation happens in
/// the endpoints; the service validates the input's content and trusts the rest.
/// </summary>
public interface IPatientWriteService
{
    /// <summary>Conditional create on the idempotency key. <c>Created</c> is false when the key had already made this patient.</summary>
    Task<(PatientWriteResult Result, bool Created)> CreateAsync(PatientInput input, string sessionToken, string idempotencyKey, CancellationToken cancellationToken);

    Task<PatientWriteResult> ReplaceAsync(string patientId, PatientInput input, string sessionToken, CancellationToken cancellationToken);

    Task<PatientWriteResult> PatchAsync(string patientId, IReadOnlyList<PatientPatchOperation> operations, string sessionToken, CancellationToken cancellationToken);

    /// <summary>Deletes the patient. A patient this session already deleted is not an error.</summary>
    Task DeleteAsync(string patientId, string sessionToken, CancellationToken cancellationToken);
}
