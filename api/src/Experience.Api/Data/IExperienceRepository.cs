using Experience.Api.Models;

namespace Experience.Api.Data;

/// <summary>
/// Storage facade for positions. Endpoints and services depend on this interface only;
/// the DynamoDB implementation sits behind it, and a JSON-file implementation serves
/// local runs and tests.
/// </summary>
public interface IExperienceRepository
{
    /// <summary>Every position, in storage order. Callers sort.</summary>
    Task<IReadOnlyList<Position>> ListAsync(CancellationToken cancellationToken);

    Task<Position?> GetAsync(string id, CancellationToken cancellationToken);

    // ---- Write side. Reserved for the admin API; not implemented in any store yet. ----

    /// <summary>Stores a new position. Throws <see cref="NotImplementedException"/> until the admin API ships.</summary>
    Task CreateAsync(Position position, CancellationToken cancellationToken);

    /// <summary>Replaces an existing position. Returns false when the id is unknown.</summary>
    Task<bool> UpdateAsync(Position position, CancellationToken cancellationToken);

    /// <summary>Removes a position. Returns false when the id is unknown.</summary>
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken);
}
