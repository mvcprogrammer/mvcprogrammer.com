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
    private static readonly JsonSerializerOptions FHIR_JSON = new JsonSerializerOptions().ForFhir(ModelInfo.ModelInspector);

    private readonly List<(string Match, Func<HttpRequestMessage, int, CancellationToken, Task<HttpResponseMessage>> Respond)> _routes = [];
    private readonly List<Uri> _requests = [];
    private readonly Lock _lock = new();

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

    public int CountOf(string pathContains) => Requests.Count(u => u.PathAndQuery.Contains(pathContains, StringComparison.Ordinal));

    public FakeFhirHandler On(string pathContains, Resource resource, HttpStatusCode status = HttpStatusCode.OK) =>
        On(pathContains, (_, _, _) => Task.FromResult(Json(resource, status)));

    public FakeFhirHandler On(string pathContains, Func<HttpRequestMessage, int, CancellationToken, Task<HttpResponseMessage>> respond)
    {
        _routes.Add((pathContains, respond));
        return this;
    }

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
            Content = new StringContent(JsonSerializer.Serialize(resource, FHIR_JSON), System.Text.Encoding.UTF8, "application/fhir+json"),
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
        int attempt;
        lock (_lock)
        {
            _requests.Add(uri);
            attempt = _requests.Count(u => u == uri);
        }

        foreach (var (match, respond) in _routes)
        {
            if (uri.PathAndQuery.Contains(match, StringComparison.Ordinal))
            {
                return await respond(request, attempt, cancellationToken);
            }
        }

        return Json(Outcome($"No route for {uri.PathAndQuery}"), HttpStatusCode.NotFound);
    }
}
