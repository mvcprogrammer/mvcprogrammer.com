using Experience.Api.Models;

namespace Experience.Api.Services;

/// <summary>Read-side rules: ordering, filtering, and skill aggregation. Storage-agnostic.</summary>
public interface IExperienceService
{
    /// <summary>Positions newest first, optionally only those listing <paramref name="skill"/> (case-insensitive).</summary>
    Task<PositionList> ListPositionsAsync(string? skill, CancellationToken cancellationToken);

    Task<Position?> GetPositionAsync(string id, CancellationToken cancellationToken);

    /// <summary>Distinct skills with the positions that list them, by position count then name.</summary>
    Task<SkillList> ListSkillsAsync(CancellationToken cancellationToken);
}
