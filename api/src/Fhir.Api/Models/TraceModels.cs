namespace Fhir.Api.Models;

/// <summary>Where the data came from. Mirrors Trace.dataSource in openapi.yaml.</summary>
public sealed record DataSource(string Name, string BaseUrl);

/// <summary>One request the function made to the sandbox, pages folded in. Mirrors UpstreamRequest in openapi.yaml.</summary>
public sealed record UpstreamRequest(string Method, string Url, int Status, long DurationMs, int Entries, int Pages);

/// <summary>
/// What happened upstream, for the "under the hood" panel. Mirrors Trace in openapi.yaml.
/// <c>TotalDurationMs</c> is wall time for the whole operation; the summary runs its searches
/// concurrently, so it is less than the sum of the requests.
/// </summary>
public sealed record Trace(
    DataSource DataSource,
    IReadOnlyList<UpstreamRequest> Requests,
    long TotalDurationMs,
    int BundleEntries,
    int PagesWalked,
    int PageCap,
    bool Truncated,
    DateTimeOffset GeneratedAt);

/// <summary>Collects upstream requests while an operation runs, then freezes into a <see cref="Trace"/>. Thread-safe.</summary>
public sealed class TraceBuilder
{
    private readonly List<UpstreamRequest> _requests = [];
    private readonly Lock _lock = new();
    private readonly DataSource _dataSource;
    private readonly int _pageCap;
    private readonly long _started = Environment.TickCount64;
    private bool _truncated;

    public TraceBuilder(DataSource dataSource, int pageCap)
    {
        ArgumentNullException.ThrowIfNull(dataSource);
        _dataSource = dataSource;
        _pageCap = pageCap;
    }

    public void Add(UpstreamRequest request, bool truncated)
    {
        ArgumentNullException.ThrowIfNull(request);
        lock (_lock)
        {
            _requests.Add(request);
            _truncated |= truncated;
        }
    }

    public Trace Build()
    {
        lock (_lock)
        {
            return new Trace(
                _dataSource,
                _requests.ToArray(),
                Environment.TickCount64 - _started,
                _requests.Sum(r => r.Entries),
                _requests.Sum(r => r.Pages),
                _pageCap,
                _truncated,
                DateTimeOffset.UtcNow);
        }
    }
}
