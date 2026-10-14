using Portfolio.Blazor.Enumerations;

namespace Portfolio.Blazor.Models;

/// <summary>One role at one organisation, as the Experience API returns it (see api/openapi.yaml).</summary>
/// <param name="Id">Stable identifier, e.g. "advancedmd".</param>
/// <param name="Title">Job title.</param>
/// <param name="Organization">Employer or client.</param>
/// <param name="StartDate">ISO 8601 year-month, e.g. 2023-12.</param>
/// <param name="EndDate">Year-month, or null while current.</param>
/// <param name="WorkMode">Remote, hybrid, or on-site.</param>
/// <param name="Location">City or region for on-site roles.</param>
/// <param name="Highlights">Bullet points shown on the timeline.</param>
/// <param name="Skills">Skill names used by the filter.</param>
public sealed record Position(
    string Id,
    string Title,
    string Organization,
    string StartDate,
    string? EndDate,
    WorkMode WorkMode,
    string Location,
    IReadOnlyList<string> Highlights,
    IReadOnlyList<string> Skills);
