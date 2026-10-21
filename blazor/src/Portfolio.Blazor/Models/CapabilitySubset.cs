namespace Portfolio.Blazor.Models;

/// <summary>The part of the sandbox CapabilityStatement the explorer depends on, from GET /api/fhir/capability.</summary>
/// <param name="Ok">True when every required resource and search parameter is supported.</param>
/// <param name="FhirVersion">FHIR version.</param>
/// <param name="Software">Server software, when named.</param>
/// <param name="BaseUrl">FHIR base URL.</param>
/// <param name="CheckedAt">ISO 8601 date-time the statement was read.</param>
/// <param name="Resources">The resources checked.</param>
public sealed record CapabilitySubset(
    bool Ok,
    string FhirVersion,
    Software? Software,
    string BaseUrl,
    string CheckedAt,
    IReadOnlyList<ResourceSupport> Resources);
