namespace Portfolio.Blazor.Models;

/// <summary>Envelope returned by GET /api/skills.</summary>
/// <param name="Count">Number of items.</param>
/// <param name="Items">Skills, most-used first.</param>
public sealed record SkillList(int Count, IReadOnlyList<Skill> Items);
