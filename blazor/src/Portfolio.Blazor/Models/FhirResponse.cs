namespace Portfolio.Blazor.Models;

/// <summary>A FHIR API answer with the response facts the "under the hood" log reports.</summary>
/// <typeparam name="T">The body type.</typeparam>
/// <param name="Body">The deserialised body, or the raw text for the bundle.</param>
/// <param name="Status">HTTP status code.</param>
/// <param name="DurationMs">Round trip as the browser saw it.</param>
/// <param name="XCache">CloudFront's X-Cache header, or null when no edge answered.</param>
/// <param name="ETag">The ETag header, when present.</param>
/// <param name="ContentType">The Content-Type header, when present.</param>
public sealed record FhirResponse<T>(T Body, int Status, long DurationMs, string? XCache, string? ETag, string? ContentType);
