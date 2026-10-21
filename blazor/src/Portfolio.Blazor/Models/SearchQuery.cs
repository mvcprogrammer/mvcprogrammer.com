namespace Portfolio.Blazor.Models;

/// <summary>The search as the FHIR function ran it, echoed back in a <see cref="PatientSearchResult"/>.</summary>
/// <param name="Family">Family name searched.</param>
/// <param name="Birthdate">Birth date filter, when given.</param>
/// <param name="Identifier">Identifier filter, when given.</param>
public sealed record SearchQuery(string Family, string? Birthdate, string? Identifier);
