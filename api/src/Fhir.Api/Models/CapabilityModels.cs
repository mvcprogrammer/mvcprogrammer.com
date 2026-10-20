using System.Text.Json.Serialization;

namespace Fhir.Api.Models;

/// <summary>Mirrors ParamSupport in openapi.yaml.</summary>
public sealed record ParamSupport(string Name, bool Supported);

/// <summary>Mirrors ResourceSupport in openapi.yaml.</summary>
public sealed record ResourceSupport(string Type, bool Supported, IReadOnlyList<ParamSupport> SearchParams);

/// <summary>Mirrors CapabilitySubset.software in openapi.yaml.</summary>
public sealed record Software(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Name,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Version);

/// <summary>The part of the sandbox CapabilityStatement the explorer depends on. Mirrors CapabilitySubset in openapi.yaml.</summary>
public sealed record CapabilitySubset(
    bool Ok,
    string FhirVersion,
    Software Software,
    string BaseUrl,
    DateTimeOffset CheckedAt,
    IReadOnlyList<ResourceSupport> Resources);
