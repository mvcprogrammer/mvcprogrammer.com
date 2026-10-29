using Fhir.Api.Models;
using Hl7.Fhir.Model;
using Hl7.Fhir.Rest;
using Task = System.Threading.Tasks.Task;

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

    /// <summary>POST {type} with If-None-Exist. <c>Created</c> is false when the sandbox returned the resource the condition already matched.</summary>
    Task<WriteResult<T>> CreateAsync<T>(T resource, SearchParams ifNoneExist, TraceBuilder trace, CancellationToken cancellationToken) where T : Resource, new();

    /// <summary>PUT {type}/{id}. Throws <see cref="UpstreamNotFoundException"/> when the sandbox has no such resource.</summary>
    Task<T> UpdateAsync<T>(T resource, TraceBuilder trace, CancellationToken cancellationToken) where T : Resource, new();

    /// <summary>DELETE {type}/{id}. A resource the sandbox no longer has is not an error.</summary>
    Task DeleteAsync<T>(string id, TraceBuilder trace, CancellationToken cancellationToken) where T : Resource, new();
}

/// <summary>What a create returned: the resource as the sandbox stored it, and whether it was made by this call.</summary>
public sealed record WriteResult<T>(T Resource, bool Created) where T : Resource;
