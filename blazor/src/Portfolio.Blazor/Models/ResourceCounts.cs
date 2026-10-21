namespace Portfolio.Blazor.Models;

/// <summary>Exact counts from <c>_summary=count</c> searches, independent of the page caps.</summary>
/// <param name="Conditions">Condition resources.</param>
/// <param name="Encounters">Encounter resources.</param>
/// <param name="Observations">Observation resources.</param>
public sealed record ResourceCounts(int Conditions, int Encounters, int Observations);
