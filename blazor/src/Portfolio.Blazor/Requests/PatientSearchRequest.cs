namespace Portfolio.Blazor.Requests;

/// <summary>The patient search as the explorer sends it to GET /api/fhir/patients.</summary>
/// <param name="Family">Family name, required; matched by the sandbox as a case-insensitive prefix.</param>
/// <param name="Birthdate">ISO 8601 date, or an empty string for none.</param>
/// <param name="Identifier">Identifier value, or <c>system|value</c>, or an empty string for none.</param>
public sealed record PatientSearchRequest(string Family, string Birthdate, string Identifier);
