namespace Fhir.Api.Fhir;

/// <summary>The sandbox has no resource at that location (it answered 404 or 410).</summary>
public sealed class UpstreamNotFoundException(string resourceType, string id)
    : Exception($"The sandbox has no {resourceType} with id '{id}'. It may have been wiped; search again.")
{
    public string ResourceType { get; } = resourceType;
    public string Id { get; } = id;
}

/// <summary>The sandbox answered badly (5xx, not FHIR, broken circuit) and retries were exhausted.</summary>
public sealed class UpstreamUnavailableException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>The upstream time budget ran out across attempts and pages.</summary>
public sealed class UpstreamTimeoutException(string message, Exception? inner = null) : Exception(message, inner);
