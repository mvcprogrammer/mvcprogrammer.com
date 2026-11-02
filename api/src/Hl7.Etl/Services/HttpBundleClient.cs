using System.Net.Http.Headers;
using System.Text.Json;
using Hl7.Etl.Exceptions;
using Hl7.Etl.Interfaces;
using Hl7.Etl.Models;
using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;

namespace Hl7.Etl.Services;

/// <summary>Posts transaction bundles to the FHIR base with the named, resilient HttpClient and reads the response bundle's per-entry status.</summary>
public sealed class HttpBundleClient : IBundleClient
{
    /// <summary>The named client the DI extension registers with the resilience handler.</summary>
    public const string CLIENT_NAME = "fhir";

    private const string FHIR_JSON = "application/fhir+json";

    private static readonly JsonSerializerOptions _fhirJson = new JsonSerializerOptions().ForFhir(ModelInfo.ModelInspector);

    private readonly IHttpClientFactory _clients;

    /// <summary>The FHIR base as an HttpClient base address: with the trailing slash, or a relative path would replace its last segment.</summary>
    public static Uri BaseAddressOf(Uri fhirBaseUrl)
    {
        ArgumentNullException.ThrowIfNull(fhirBaseUrl);
        var text = fhirBaseUrl.ToString();
        return text.EndsWith('/') ? fhirBaseUrl : new Uri(text + "/");
    }

    /// <summary>Creates the client over the factory.</summary>
    public HttpBundleClient(IHttpClientFactory clients)
    {
        ArgumentNullException.ThrowIfNull(clients);
        _clients = clients;
    }

    /// <inheritdoc />
    public async Task<BatchOutcome> PostTransactionAsync(Bundle bundle, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(bundle);

        using var client = _clients.CreateClient(CLIENT_NAME);
        using var request = new HttpRequestMessage(HttpMethod.Post, string.Empty)
        {
            Content = new StringContent(JsonSerializer.Serialize(bundle, _fhirJson)),
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(FHIR_JSON);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(FHIR_JSON));
        // The entries' status lines are all the loader needs; the resources themselves would only cost bandwidth.
        request.Headers.Add("Prefer", "return=minimal");

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new BundleRejectedException(response.StatusCode, OutcomeText(body));
        }

        var answer = Parse(body) as Bundle ?? throw new BundleRejectedException(response.StatusCode, "The server answered 2xx without a Bundle.");
        var created = answer.Entry.Count(e => e.Response?.Status?.StartsWith("201", StringComparison.Ordinal) == true);
        var present = answer.Entry.Count(e => e.Response?.Status?.StartsWith("200", StringComparison.Ordinal) == true);
        return new BatchOutcome(answer.Id ?? "unknown", created, present);
    }

    /// <inheritdoc />
    public async Task<string?> FindIdAsync(string resourceType, string identifierToken, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(resourceType);
        ArgumentException.ThrowIfNullOrWhiteSpace(identifierToken);

        using var client = _clients.CreateClient(CLIENT_NAME);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{resourceType}?identifier={Uri.EscapeDataString(identifierToken)}&_count=1");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(FHIR_JSON));
        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new BundleRejectedException(response.StatusCode, OutcomeText(body));
        }

        var found = Parse(body) as Bundle ?? throw new BundleRejectedException(response.StatusCode, "The server answered a search without a Bundle.");
        return found.Entry.FirstOrDefault()?.Resource?.Id;
    }

    /// <summary>The body as a resource; a body the strict parser faults on still yields what it could read, because the loader only needs ids and status lines.</summary>
    private static Resource? Parse(string body)
    {
        try
        {
            return JsonSerializer.Deserialize<Resource>(body, _fhirJson);
        }
        catch (DeserializationFailedException ex)
        {
            return ex.PartialResult as Resource;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>The first issue of an OperationOutcome body, else the body itself cut short.</summary>
    public static string OutcomeText(string body)
    {
        ArgumentNullException.ThrowIfNull(body);
        if (Parse(body) is OperationOutcome outcome && outcome.Issue.Count > 0)
        {
            var issue = outcome.Issue[0];
            return issue.Diagnostics ?? issue.Details?.Text ?? issue.Code?.ToString() ?? "OperationOutcome without text";
        }

        return body.Length > 300 ? body[..300] : body;
    }
}
