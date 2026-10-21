namespace Portfolio.Blazor.Models;

/// <summary>Whether the sandbox supports one search parameter the explorer needs.</summary>
/// <param name="Name">Parameter name.</param>
/// <param name="Supported">True when supported.</param>
public sealed record ParamSupport(string Name, bool Supported);
