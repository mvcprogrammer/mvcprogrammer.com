namespace Portfolio.Blazor.Models;

/// <summary>A skill aggregated across positions, from GET /api/skills.</summary>
/// <param name="Name">Skill name as shown on the chip.</param>
/// <param name="PositionCount">How many positions list it.</param>
/// <param name="PositionIds">Identifiers of those positions.</param>
public sealed record Skill(string Name, int PositionCount, IReadOnlyList<string> PositionIds);
