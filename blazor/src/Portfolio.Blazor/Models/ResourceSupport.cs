namespace Portfolio.Blazor.Models;

/// <summary>Whether the sandbox supports one resource type the explorer needs, with its search parameters.</summary>
/// <param name="Type">Patient, Condition, Observation, or Encounter.</param>
/// <param name="Supported">True when the resource can be read and searched.</param>
/// <param name="SearchParams">The parameters checked.</param>
public sealed record ResourceSupport(string Type, bool Supported, IReadOnlyList<ParamSupport> SearchParams);
