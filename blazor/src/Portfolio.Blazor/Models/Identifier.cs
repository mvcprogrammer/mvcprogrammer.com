namespace Portfolio.Blazor.Models;

/// <summary>One <c>Patient.identifier</c>, kept so the summary can show the MRN with its system.</summary>
/// <param name="System">Identifier system URI, when present.</param>
/// <param name="Value">Identifier value.</param>
/// <param name="Type">The identifier type code (<c>MR</c>, <c>SS</c>, <c>DL</c>, ...), when present.</param>
public sealed record Identifier(string? System, string Value, string? Type);
