using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using Microsoft.Extensions.Options;
using Portfolio.Blazor.Configurations;
using Portfolio.Blazor.Exceptions;
using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Models;
using Portfolio.Blazor.Requests;
using Portfolio.Blazor.Serialization;

namespace Portfolio.Blazor.Services;

/// <summary>Typed HttpClient for the FHIR API. The client's base address is the site origin; CloudFront routes /api/fhir to the Lambda.</summary>
public sealed class FhirClient : IFhirClient
{
    private const string JSON_ACCEPT = "application/json, application/problem+json";
    private const string FHIR_ACCEPT = "application/fhir+json, application/problem+json";

    private readonly HttpClient _http;
    private readonly SiteOptions _options;

    /// <summary>Creates the client.</summary>
    /// <param name="http">Client whose base address is the site origin, with the explorer's timeout.</param>
    /// <param name="options">Site endpoints.</param>
    public FhirClient(HttpClient http, IOptions<SiteOptions> options)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(options);

        _http = http;
        _options = options.Value;
    }

    /// <inheritdoc />
    public Task<FhirResponse<PatientSearchResult>> SearchPatientsAsync(PatientSearchRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var path = $"{_options.FhirApiBase}/patients?family={Uri.EscapeDataString(request.Family)}";
        if (request.Birthdate.Length > 0)
        {
            path += "&birthdate=" + Uri.EscapeDataString(request.Birthdate);
        }

        if (request.Identifier.Length > 0)
        {
            path += "&identifier=" + Uri.EscapeDataString(request.Identifier);
        }

        return GetJsonAsync(path, PortfolioJsonContext.Default.PatientSearchResult, cancellationToken);
    }

    /// <inheritdoc />
    public Task<FhirResponse<PatientSummary>> GetSummaryAsync(string patientId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);

        return GetJsonAsync($"{_options.FhirApiBase}/patients/{Uri.EscapeDataString(patientId)}/summary", PortfolioJsonContext.Default.PatientSummary, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<FhirResponse<string>> GetRawBundleAsync(string patientId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);

        var started = Stopwatch.StartNew();
        using var response = await SendAsync($"{_options.FhirApiBase}/patients/{Uri.EscapeDataString(patientId)}/raw", FHIR_ACCEPT, started, cancellationToken);
        var text = await response.Content.ReadAsStringAsync(cancellationToken);
        return ToFhirResponse(response, text, started);
    }

    /// <inheritdoc />
    public Task<FhirResponse<CapabilitySubset>> GetCapabilityAsync(CancellationToken cancellationToken) =>
        GetJsonAsync($"{_options.FhirApiBase}/capability", PortfolioJsonContext.Default.CapabilitySubset, cancellationToken);

    private static FhirResponse<T> ToFhirResponse<T>(HttpResponseMessage response, T body, Stopwatch started) =>
        new(
            body,
            (int)response.StatusCode,
            started.ElapsedMilliseconds,
            Header(response, "x-cache"),
            response.Headers.ETag?.ToString(),
            response.Content.Headers.ContentType?.ToString());

    private static string? Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) ? values.FirstOrDefault() : null;

    private async Task<FhirResponse<T>> GetJsonAsync<T>(string path, JsonTypeInfo<T> typeInfo, CancellationToken cancellationToken)
    {
        var started = Stopwatch.StartNew();
        using var response = await SendAsync(path, JSON_ACCEPT, started, cancellationToken);
        T? body;
        try
        {
            body = await response.Content.ReadFromJsonAsync(typeInfo, cancellationToken);
        }
        catch (JsonException ex)
        {
            throw new FhirProblemException(FhirProblemException.NOT_JSON_MESSAGE, (int)response.StatusCode, null, started.ElapsedMilliseconds, Header(response, "x-cache"), false, ex);
        }

        if (body is null)
        {
            throw FhirProblemException.NotJson((int)response.StatusCode, started.ElapsedMilliseconds, Header(response, "x-cache"));
        }

        return ToFhirResponse(response, body, started);
    }

    /// <summary>GET with the accept header; a status outside 2xx becomes a problem from the body, a cancellation a timeout, anything else unreachable.</summary>
    private async Task<HttpResponseMessage> SendAsync(string path, string accept, Stopwatch started, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Accept.ParseAdd(accept);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw FhirProblemException.TimedOutAfter(started.ElapsedMilliseconds, ex);
        }
        catch (HttpRequestException ex)
        {
            throw FhirProblemException.Unreachable(started.ElapsedMilliseconds, ex);
        }

        if (response.IsSuccessStatusCode)
        {
            return response;
        }

        using (response)
        {
            ProblemDetails? problem = null;
            try
            {
                problem = await response.Content.ReadFromJsonAsync(PortfolioJsonContext.Default.ProblemDetails, cancellationToken);
            }
            catch (JsonException)
            {
                problem = null;
            }

            throw FhirProblemException.FromResponse((int)response.StatusCode, problem, started.ElapsedMilliseconds, Header(response, "x-cache"));
        }
    }
}
