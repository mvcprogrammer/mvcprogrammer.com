using System.Net;
using System.Text.Json;
using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;
using Task = System.Threading.Tasks.Task;

namespace Hl7.Etl.Tests.Fakes;

/// <summary>Plays the FHIR server: one scripted answer per request, in order, with every request body kept for the assertions.</summary>
public sealed class ScriptedHandler : HttpMessageHandler
{
    private static readonly JsonSerializerOptions _fhirJson = new JsonSerializerOptions().ForFhir(ModelInfo.ModelInspector);

    private readonly Queue<Func<CancellationToken, Task<HttpResponseMessage>>> _answers = new();

    /// <summary>The transaction bundles received, parsed, in order.</summary>
    public List<Bundle> Received { get; } = [];

    /// <summary>The Prefer headers received, in order.</summary>
    public List<string?> Prefer { get; } = [];

    /// <summary>The GET paths received (identifier lookups), in order.</summary>
    public List<string> Lookups { get; } = [];

    /// <summary>What a lookup finds, keyed by the path and query a lookup sends; a lookup not listed here finds nothing.</summary>
    public Dictionary<string, string> Found { get; } = new(StringComparer.Ordinal);

    /// <summary>Answers the next request with a response bundle whose entries carry the given status lines.</summary>
    public ScriptedHandler ThenTransactionResponse(string bundleId, params string[] statuses)
    {
        var bundle = new Bundle { Id = bundleId, Type = Bundle.BundleType.TransactionResponse };
        foreach (var status in statuses)
        {
            bundle.Entry.Add(new Bundle.EntryComponent { Response = new Bundle.ResponseComponent { Status = status } });
        }

        return Then(_ => Task.FromResult(Json(HttpStatusCode.OK, bundle)));
    }

    /// <summary>Answers the next request with an OperationOutcome at the status.</summary>
    public ScriptedHandler ThenOutcome(HttpStatusCode status, string diagnostics)
    {
        var outcome = new OperationOutcome();
        outcome.Issue.Add(new OperationOutcome.IssueComponent { Severity = OperationOutcome.IssueSeverity.Error, Code = OperationOutcome.IssueType.Processing, Diagnostics = diagnostics });
        return Then(_ => Task.FromResult(Json(status, outcome)));
    }

    /// <summary>Never answers the next request: the attempt timeout must end it.</summary>
    public ScriptedHandler ThenHang() => Then(async ct =>
    {
        await Task.Delay(Timeout.InfiniteTimeSpan, ct);
        throw new InvalidOperationException("unreachable");
    });

    private ScriptedHandler Then(Func<CancellationToken, Task<HttpResponseMessage>> answer)
    {
        _answers.Enqueue(answer);
        return this;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.Method == HttpMethod.Get)
        {
            var path = request.RequestUri!.PathAndQuery;
            Lookups.Add(path);
            var searchset = new Bundle { Type = Bundle.BundleType.Searchset };
            if (Found.TryGetValue(path, out var id))
            {
                var type = path.TrimStart('/').Split('?')[0];
                Resource resource = type == "Encounter" ? new Encounter { Id = id } : new Patient { Id = id };
                searchset.Entry.Add(new Bundle.EntryComponent { Resource = resource });
            }

            return Json(HttpStatusCode.OK, searchset);
        }

        var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
        if (body.Length > 0)
        {
            Received.Add(JsonSerializer.Deserialize<Bundle>(body, _fhirJson)!);
        }

        Prefer.Add(request.Headers.TryGetValues("Prefer", out var values) ? string.Join(",", values) : null);
        if (_answers.Count == 0)
        {
            throw new InvalidOperationException("No answer scripted for this request.");
        }

        return await _answers.Dequeue()(cancellationToken);
    }

    private static HttpResponseMessage Json(HttpStatusCode status, Resource resource) => new(status)
    {
        Content = new StringContent(JsonSerializer.Serialize(resource, resource.GetType(), _fhirJson), System.Text.Encoding.UTF8, "application/fhir+json"),
    };
}
