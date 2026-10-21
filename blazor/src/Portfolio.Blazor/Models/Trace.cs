namespace Portfolio.Blazor.Models;

/// <summary>What happened upstream, for the "under the hood" panel. A cached response carries the original request's trace.</summary>
/// <param name="DataSource">The sandbox.</param>
/// <param name="Requests">Every request made to it.</param>
/// <param name="TotalDurationMs">Wall time across all of them.</param>
/// <param name="BundleEntries">Entries received across every request.</param>
/// <param name="PagesWalked">Pages walked across every request.</param>
/// <param name="PageCap">Maximum pages followed per search.</param>
/// <param name="Truncated">True when any search hit the page cap, so a list may be incomplete.</param>
/// <param name="GeneratedAt">ISO 8601 date-time the trace was recorded.</param>
public sealed record Trace(
    DataSource DataSource,
    IReadOnlyList<UpstreamRequest> Requests,
    int TotalDurationMs,
    int BundleEntries,
    int PagesWalked,
    int PageCap,
    bool Truncated,
    string GeneratedAt);
