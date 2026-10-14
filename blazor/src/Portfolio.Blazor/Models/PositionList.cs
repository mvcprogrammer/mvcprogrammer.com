namespace Portfolio.Blazor.Models;

/// <summary>Envelope returned by GET /api/experience.</summary>
/// <param name="Count">Number of items.</param>
/// <param name="Items">Positions, newest first.</param>
public sealed record PositionList(int Count, IReadOnlyList<Position> Items);
