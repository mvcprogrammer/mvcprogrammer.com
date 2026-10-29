using System.Diagnostics;
using System.Net;
using Fhir.Api.Configuration;
using Fhir.Api.Models;
using Hl7.Fhir.Model;
using Hl7.Fhir.Rest;
using Hl7.Fhir.Serialization;
using Microsoft.Extensions.Options;
using Polly.CircuitBreaker;
using Polly.Timeout;

namespace Fhir.Api.Fhir;

/// <summary>
/// Firely <see cref="FhirClient"/> over the named "fhir" HttpClient, which carries the standard
/// resilience handler (per-attempt timeout, retry with backoff and jitter, circuit breaker, total
/// timeout). One client is created per call; the HttpClient underneath is pooled by the factory.
/// </summary>
public sealed class FhirGateway : IFhirGateway
{
    public const string CLIENT_NAME = "fhir";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly FhirOptions _options;
    private readonly ILogger<FhirGateway> _logger;

    public FhirGateway(IHttpClientFactory httpClientFactory, IOptions<FhirOptions> options, ILogger<FhirGateway> logger)
    {
        ArgumentNullException.ThrowIfNull(httpClientFactory);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(logger);
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<T> ReadAsync<T>(string id, TraceBuilder trace, CancellationToken cancellationToken) where T : Resource, new()
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(id);
        ArgumentNullException.ThrowIfNull(trace);

        var type = typeof(T).Name;
        var location = $"{type}/{id}";
        using var client = CreateClient();
        var watch = Stopwatch.StartNew();
        try
        {
            var resource = await client.ReadAsync<T>(location, ct: cancellationToken)
                ?? throw new UpstreamNotFoundException(type, id);
            trace.Add(new UpstreamRequest("GET", Url(location), StatusOf(client), watch.ElapsedMilliseconds, 1, 1), truncated: false);
            return resource;
        }
        catch (FhirOperationException ex) when (ex.Status is HttpStatusCode.NotFound or HttpStatusCode.Gone)
        {
            trace.Add(new UpstreamRequest("GET", Url(location), (int)ex.Status, watch.ElapsedMilliseconds, 0, 1), truncated: false);
            throw new UpstreamNotFoundException(type, id);
        }
        catch (Exception ex) when (ex is not UpstreamNotFoundException)
        {
            throw Translate(ex, Url(location), cancellationToken);
        }
    }

    public async Task<SearchResult<T>> SearchAsync<T>(SearchParams query, int pageCap, TraceBuilder trace, CancellationToken cancellationToken) where T : Resource, new()
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(trace);
        ArgumentOutOfRangeException.ThrowIfLessThan(pageCap, 1);

        var url = SearchUrl<T>(query);
        using var client = CreateClient();
        var watch = Stopwatch.StartNew();
        var resources = new List<T>();
        try
        {
            var bundle = await client.SearchAsync<T>(query, ct: cancellationToken)
                ?? throw new UpstreamUnavailableException($"{Host} answered without a Bundle.");
            var total = bundle.Total;
            var pages = 0;
            var truncated = false;
            while (bundle is not null)
            {
                pages++;
                resources.AddRange(bundle.Entry.Select(e => e.Resource).OfType<T>());
                if (bundle.NextLink is null)
                {
                    break;
                }

                if (pages >= pageCap)
                {
                    truncated = true;
                    break;
                }

                bundle = await client.ContinueAsync(bundle, PageDirection.Next, cancellationToken);
            }

            trace.Add(new UpstreamRequest("GET", url, StatusOf(client), watch.ElapsedMilliseconds, resources.Count, pages), truncated);
            return new SearchResult<T>(resources, total, pages);
        }
        catch (Exception ex) when (ex is not UpstreamUnavailableException)
        {
            throw Translate(ex, url, cancellationToken);
        }
    }

    public async Task<int> CountAsync<T>(SearchParams query, TraceBuilder trace, CancellationToken cancellationToken) where T : Resource, new()
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(trace);

        query.SummaryOnly(SummaryType.Count);
        var url = SearchUrl<T>(query);
        using var client = CreateClient();
        var watch = Stopwatch.StartNew();
        try
        {
            var bundle = await client.SearchAsync<T>(query, ct: cancellationToken)
                ?? throw new UpstreamUnavailableException($"{Host} answered without a Bundle.");
            var total = bundle.Total ?? 0;
            trace.Add(new UpstreamRequest("GET", url, StatusOf(client), watch.ElapsedMilliseconds, total, 1), truncated: false);
            return total;
        }
        catch (Exception ex) when (ex is not UpstreamUnavailableException)
        {
            throw Translate(ex, url, cancellationToken);
        }
    }

    public async Task<CapabilityStatement> CapabilityStatementAsync(TraceBuilder trace, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(trace);

        var url = Url("metadata");
        using var client = CreateClient();
        var watch = Stopwatch.StartNew();
        try
        {
            var statement = await client.CapabilityStatementAsync(ct: cancellationToken)
                ?? throw new UpstreamUnavailableException($"{Host} answered metadata without a CapabilityStatement.");
            trace.Add(new UpstreamRequest("GET", url, StatusOf(client), watch.ElapsedMilliseconds, 1, 1), truncated: false);
            return statement;
        }
        catch (Exception ex) when (ex is not UpstreamUnavailableException)
        {
            throw Translate(ex, url, cancellationToken);
        }
    }

    private string Host => _options.BaseUrl.Host;

    private string Url(string relative) => $"{_options.BaseUrl.ToString().TrimEnd('/')}/{relative}";

    private string SearchUrl<T>(SearchParams query) => Url($"{typeof(T).Name}?{query.ToUriParamList().ToQueryString()}");

    private FhirClient CreateClient()
    {
        var http = _httpClientFactory.CreateClient(CLIENT_NAME);
        var settings = new FhirClientSettings
        {
            PreferredFormat = ResourceFormat.Json,
            // Never reads metadata on its own; the capability endpoint does that lazily.
            VerifyFhirVersion = false,
            // The resilience handler owns the timeouts; keep Firely's own above the total budget.
            Timeout = _options.TotalTimeoutMs + 1_000,
        };
        return new FhirClient(_options.BaseUrl, http, settings);
    }

    private static int StatusOf(FhirClient client) =>
        int.TryParse(client.LastResult?.Status, out var status) ? status : 200;

    private Exception Translate(Exception ex, string url, CancellationToken cancellationToken)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            return ex;
        }

        switch (ex)
        {
            case UpstreamTimeoutException or UpstreamUnavailableException or UpstreamNotFoundException:
                return ex;
            case TimeoutRejectedException or TaskCanceledException or OperationCanceledException:
                _logger.LogWarning("Upstream timeout after {Budget} ms: GET {Url}", _options.TotalTimeoutMs, url);
                return new UpstreamTimeoutException($"{Host} did not finish answering within {_options.TotalTimeoutMs / 1000} seconds.", ex);
            case FhirOperationException op:
                _logger.LogWarning("Upstream {Status}: GET {Url}", (int)op.Status, url);
                return new UpstreamUnavailableException($"{Host} answered {(int)op.Status}.", ex);
            case BrokenCircuitException:
                _logger.LogWarning("Upstream circuit open: GET {Url}", url);
                return new UpstreamUnavailableException($"{Host} has failed repeatedly; the circuit is open for a moment.", ex);
            case HttpRequestException http:
                _logger.LogWarning("Upstream unreachable ({Reason}): GET {Url}", http.HttpRequestError, url);
                return new UpstreamUnavailableException($"{Host} could not be reached.", ex);
            case DeserializationFailedException or FormatException or System.Text.Json.JsonException:
                _logger.LogWarning("Upstream body was not FHIR: GET {Url}", url);
                return new UpstreamUnavailableException($"{Host} answered with something that is not a FHIR resource.", ex);
            default:
                return ex;
        }
    }
}
