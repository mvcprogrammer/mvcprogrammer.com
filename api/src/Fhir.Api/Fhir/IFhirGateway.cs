using Fhir.Api.Models;
using Hl7.Fhir.Model;
using Hl7.Fhir.Rest;

namespace Fhir.Api.Fhir;

/// <summary>A search walked through its pages. Truncation is recorded on the trace, not here.</summary>
public sealed record SearchResult<T>(IReadOnlyList<T> Resources, int? Total, int Pages)
    where T : Resource;

/// <summary>
/// The only thing in the function that talks to the sandbox. Every call records itself on the
/// trace and translates failures into the three upstream exceptions, so callers never see
/// HTTP or Firely details.
/// </summary>
public interface IFhirGateway
{
    /// <summary>GET {type}/{id}. Throws <see cref="UpstreamNotFoundException"/> when the sandbox has no such resource.</summary>
    Task<T> ReadAsync<T>(string id, TraceBuilder trace, CancellationToken cancellationToken) where T : Resource, new();

    /// <summary>GET {type}?{query}, then link[rel=next] up to <paramref name="pageCap"/> pages.</summary>
    Task<SearchResult<T>> SearchAsync<T>(SearchParams query, int pageCap, TraceBuilder trace, CancellationToken cancellationToken) where T : Resource, new();

    /// <summary>GET {type}?{query}&amp;_summary=count. Returns Bundle.total, or 0 when the sandbox omits it.</summary>
    Task<int> CountAsync<T>(SearchParams query, TraceBuilder trace, CancellationToken cancellationToken) where T : Resource, new();

    /// <summary>GET metadata.</summary>
    Task<CapabilityStatement> CapabilityStatementAsync(TraceBuilder trace, CancellationToken cancellationToken);
}
