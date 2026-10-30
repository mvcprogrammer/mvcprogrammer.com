using Fhir.Api.Models;

namespace Fhir.Api.Services;

/// <summary>
/// The condition write behind the endpoint, under the demo guard. Header and body shape are
/// validated in the endpoint; the service owns the pick list, the cap, and the conditional create.
/// </summary>
public interface IConditionWriteService
{
    /// <summary>Records a listed condition on a patient this session created. <c>Created</c> is false when the patient already had it active and the existing resource is returned.</summary>
    Task<(ConditionWriteResult Result, bool Created)> AddAsync(string patientId, ConditionInput input, string sessionToken, CancellationToken cancellationToken);
}
