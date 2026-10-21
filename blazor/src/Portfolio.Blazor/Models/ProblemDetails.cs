namespace Portfolio.Blazor.Models;

/// <summary>RFC 9457 problem details as the FHIR function sends them.</summary>
/// <param name="Title">Short summary.</param>
/// <param name="Status">HTTP status.</param>
/// <param name="Detail">Explanation for this occurrence, when given.</param>
public sealed record ProblemDetails(string? Title, int? Status, string? Detail);
