using System.Net;
using System.Text.Json;
using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;
using Task = System.Threading.Tasks.Task;

namespace Fhir.Api.Tests.Fakes;

/// <summary>
/// Stands in for the sandbox. Routes match on a substring of the request's path and query, in
/// the order they were added; an unmatched request answers a 404 OperationOutcome. Every
/// request is recorded so tests can assert on what went upstream and how many times.
/// </summary>
public sealed class FakeFhirHandler : HttpMessageHandler
{
    private static readonly JsonSerializerOptions _fhirJson = new JsonSerializerOptions().ForFhir(ModelInfo.ModelInspector);

    private readonly List<(HttpMethod? Method, string Match, Func<HttpRequestMessage, int, CancellationToken, Task<HttpResponseMessage>> Respond)> _routes = [];
    private readonly List<Uri> _requests = [];
    private readonly List<SentRequest> _sent = [];
    private readonly Lock _lock = new();

    /// <summary>What a request carried upstream: the method, the URI, the If-None-Exist header when present, and the body text.</summary>
    public sealed record SentRequest(HttpMethod Method, Uri Uri, string? IfNoneExist, string Body);

    /// <summary>Every upstream request so far, in order.</summary>
    public IReadOnlyList<Uri> Requests
    {
        get
        {
            lock (_lock)
            {
                return _requests.ToArray();
            }
        }
    }

    /// <summary>Every upstream request so far with its method, headers of interest, and body, in order.</summary>
    public IReadOnlyList<SentRequest> Sent
    {
        get
        {
            lock (_lock)
            {
                return _sent.ToArray();
            }
        }
    }

    public int CountOf(string pathContains) => Requests.Count(u => u.PathAndQuery.Contains(pathContains, StringComparison.Ordinal));

    public FakeFhirHandler On(string pathContains, Resource resource, HttpStatusCode status = HttpStatusCode.OK) =>
        On(pathContains, (_, _, _) => Task.FromResult(Json(resource, status)));

    public FakeFhirHandler On(string pathContains, Func<HttpRequestMessage, int, CancellationToken, Task<HttpResponseMessage>> respond)
    {
        _routes.Add((null, pathContains, respond));
        return this;
    }

    /// <summary>A route that matches one method only, so a GET and a PUT of the same resource can answer differently.</summary>
    public FakeFhirHandler On(HttpMethod method, string pathContains, Resource resource, HttpStatusCode status = HttpStatusCode.OK) =>
        On(method, pathContains, (_, _, _) => Task.FromResult(Json(resource, status)));

    public FakeFhirHandler On(HttpMethod method, string pathContains, Func<HttpRequestMessage, int, CancellationToken, Task<HttpResponseMessage>> respond)
    {
        _routes.Add((method, pathContains, respond));
        return this;
    }

    /// <summary>An empty answer with the given status, as a DELETE or a missing resource gets.</summary>
    public FakeFhirHandler OnStatus(HttpMethod method, string pathContains, HttpStatusCode status) =>
        On(method, pathContains, (_, _, _) => Task.FromResult(new HttpResponseMessage(status)));

    /// <summary>A response body that is not JSON at all.</summary>
    public FakeFhirHandler OnGarbage(string pathContains) =>
        On(pathContains, (_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("<html>not fhir</html>", System.Text.Encoding.UTF8, "text/html"),
        }));

    /// <summary>A server error on every attempt.</summary>
    public FakeFhirHandler OnServerError(string pathContains, HttpStatusCode status = HttpStatusCode.ServiceUnavailable) =>
        On(pathContains, (_, _, _) => Task.FromResult(Json(Outcome("Down for maintenance"), status)));

    /// <summary>Never answers within the attempt timeout.</summary>
    public FakeFhirHandler OnHang(string pathContains) =>
        On(pathContains, async (_, _, ct) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
            return Json(Outcome("too late"), HttpStatusCode.OK);
        });

    public static HttpResponseMessage Json(Resource resource, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status)
        {
            Content = new StringContent(JsonSerializer.Serialize(resource, _fhirJson), System.Text.Encoding.UTF8, "application/fhir+json"),
        };

    public static OperationOutcome Outcome(string text) => new()
    {
        Issue =
        [
            new OperationOutcome.IssueComponent
            {
                Severity = OperationOutcome.IssueSeverity.Error,
                Code = OperationOutcome.IssueType.Exception,
                Diagnostics = text,
            },
        ],
    };

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var uri = request.RequestUri!;
        var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
        var ifNoneExist = request.Headers.TryGetValues("If-None-Exist", out var values) ? string.Join(",", values) : null;
        int attempt;
        lock (_lock)
        {
            _requests.Add(uri);
            _sent.Add(new SentRequest(request.Method, uri, ifNoneExist, body));
            attempt = _requests.Count(u => u == uri);
        }

        foreach (var (method, match, respond) in _routes)
        {
            if ((method is null || method == request.Method) && uri.PathAndQuery.Contains(match, StringComparison.Ordinal))
            {
                return await respond(request, attempt, cancellationToken);
            }
        }

        return Json(Outcome($"No route for {uri.PathAndQuery}"), HttpStatusCode.NotFound);
    }
}
