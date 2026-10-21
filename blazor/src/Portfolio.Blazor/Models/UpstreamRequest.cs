namespace Portfolio.Blazor.Models;

/// <summary>One request the FHIR function made to the sandbox, with its paging walk folded in.</summary>
/// <param name="Method">HTTP method.</param>
/// <param name="Url">The first page's URL; later pages come from <c>link[rel=next]</c>.</param>
/// <param name="Status">HTTP status of the last page fetched.</param>
/// <param name="DurationMs">Wall time across every attempt and page.</param>
/// <param name="Entries">Bundle entries received across all pages, or the total for a count search.</param>
/// <param name="Pages">Pages walked, including the first.</param>
public sealed record UpstreamRequest(string Method, string Url, int Status, int DurationMs, int Entries, int Pages);
