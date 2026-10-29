using System.Text.Json.Serialization;

namespace Experience.Api.Models;

/// <summary>Where the work happened. Serialised in kebab-case: remote, hybrid, on-site.</summary>
public enum WorkMode
{
    Remote,
    Hybrid,
    OnSite,
}

/// <summary>One role at one organisation. Mirrors the Position schema in openapi.yaml.</summary>
/// <param name="StartDate">ISO 8601 year-month, e.g. 2023-12.</param>
/// <param name="EndDate">Year-month, or null while current.</param>
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

/// <summary>Body of a create or update. Everything but the id, which comes from the path on update.</summary>
public sealed record PositionInput(
    string Title,
    string Organization,
    string StartDate,
    string? EndDate,
    WorkMode WorkMode,
    string Location,
    IReadOnlyList<string> Highlights,
    IReadOnlyList<string> Skills)
{
    public Position ToPosition(string id) =>
        new(id, Title, Organization, StartDate, EndDate, WorkMode, Location, Highlights, Skills);
}

public sealed record PositionFilter(string Skill);

public sealed record PositionList(int Count, IReadOnlyList<Position> Items)
{
    /// <summary>Present only when a filter was applied.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    // ReSharper disable once UnusedAutoPropertyAccessor.Global
    public PositionFilter? Filter { get; init; }
}

public sealed record Skill(string Name, int PositionCount, IReadOnlyList<string> PositionIds);

public sealed record SkillList(int Count, IReadOnlyList<Skill> Items);

public sealed record Health(string Status, string Version);
