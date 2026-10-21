namespace Portfolio.Blazor.Models;

/// <summary>A patient's conditions split on clinical status.</summary>
/// <param name="Active">Active, recurrence, or relapse; newest onset first.</param>
/// <param name="Resolved">Inactive, remission, or resolved; the card collapses these into a count.</param>
public sealed record Conditions(IReadOnlyList<ConditionItem> Active, IReadOnlyList<ConditionItem> Resolved);
