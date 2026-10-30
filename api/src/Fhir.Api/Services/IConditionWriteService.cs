using Fhir.Api.Models;

namespace Fhir.Api.Services;

/// <summary>
/// The condition writes behind the endpoints, under the demo guard. Header, path, and body shape are
/// validated in the endpoints; the service owns the pick list, the cap, the conditional create, and
/// the resolved transition.
/// </summary>
public interface IConditionWriteService
{
    /// <summary>Records a listed condition on a patient this session created. <c>Created</c> is false when the patient already had it active and the existing resource is returned.</summary>
    Task<(ConditionWriteResult Result, bool Created)> AddAsync(string patientId, ConditionInput input, string sessionToken, CancellationToken cancellationToken);

    /// <summary>Sets a condition of a patient this session created to resolved. A condition already resolved is left as it is; one that does not reference the patient is not found.</summary>
    Task ResolveAsync(string patientId, string conditionId, string sessionToken, CancellationToken cancellationToken);
}
