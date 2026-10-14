using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using Portfolio.Blazor.Configurations;
using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Requests;
using Portfolio.Blazor.Serialization;

namespace Portfolio.Blazor.Services;

/// <summary>Posts contact messages to the Lambda function URL in <see cref="SiteOptions.ContactEndpoint"/>.</summary>
public sealed class ContactClient : IContactClient
{
    private readonly HttpClient _http;
    private readonly Uri _endpoint;

    /// <summary>Creates the client.</summary>
    /// <param name="http">Client with an explicit timeout; no base address, the endpoint is absolute.</param>
    /// <param name="options">Site endpoints.</param>
    public ContactClient(HttpClient http, IOptions<SiteOptions> options)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(options);

        _http = http;
        _endpoint = new Uri(options.Value.ContactEndpoint);
    }

    /// <inheritdoc />
    public async Task SendAsync(ContactRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        using var response = await _http.PostAsJsonAsync(_endpoint, request, PortfolioJsonContext.Default.ContactRequest, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}
