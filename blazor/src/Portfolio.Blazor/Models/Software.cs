namespace Portfolio.Blazor.Models;

/// <summary>The sandbox server software named in its CapabilityStatement.</summary>
/// <param name="Name">Software name, when present.</param>
/// <param name="Version">Software version, when present.</param>
public sealed record Software(string? Name, string? Version);
