using Portfolio.Blazor.Models;

namespace Portfolio.Blazor.Interfaces;

/// <summary>Reads the Experience API, with the bundled seed file as the offline fallback.</summary>
public interface IExperienceClient
{
    /// <summary>GET /api/experience, optionally filtered to positions that list a skill.</summary>
    /// <param name="skill">Skill name to filter by, or null for every position.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    Task<PositionList> GetExperienceAsync(string? skill, CancellationToken cancellationToken);

    /// <summary>GET /api/skills: every skill with the number of positions that list it.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    Task<SkillList> GetSkillsAsync(CancellationToken cancellationToken);

    /// <summary>The copy of api/seed/positions.json published with the site, for when the API is unreachable.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    Task<IReadOnlyList<Position>> GetSeedAsync(CancellationToken cancellationToken);
}
