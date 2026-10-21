namespace Portfolio.Blazor.Models;

/// <summary>Envelope returned by GET /api/fhir/patients: one page of at most twenty matches.</summary>
/// <param name="Count">Number of items returned.</param>
/// <param name="Total">Matches on the server, present only when the sandbox reported a total.</param>
/// <param name="Query">The search as the function ran it.</param>
/// <param name="Items">The rows.</param>
/// <param name="Trace">What happened upstream.</param>
public sealed record PatientSearchResult(int Count, int? Total, SearchQuery Query, IReadOnlyList<PatientListItem> Items, Trace Trace);
