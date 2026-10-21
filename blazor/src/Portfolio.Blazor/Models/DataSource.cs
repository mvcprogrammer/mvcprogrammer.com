namespace Portfolio.Blazor.Models;

/// <summary>The sandbox a trace was recorded against.</summary>
/// <param name="Name">Server name.</param>
/// <param name="BaseUrl">FHIR base URL.</param>
public sealed record DataSource(string Name, string BaseUrl);
