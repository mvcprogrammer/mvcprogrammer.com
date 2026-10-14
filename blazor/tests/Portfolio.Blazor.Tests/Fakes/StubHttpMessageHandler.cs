using System.Net;

namespace Portfolio.Blazor.Tests.Fakes;

/// <summary>Answers every request with one scripted response and keeps the requests for assertions.</summary>
internal sealed class StubHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _respond;

    /// <summary>Creates a handler that answers with <paramref name="respond"/>.</summary>
    /// <param name="respond">Builds the response for a request.</param>
    public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> respond)
    {
        _respond = respond;
    }

    /// <summary>Every request received, in order.</summary>
    public List<HttpRequestMessage> Requests { get; } = [];

    /// <summary>Bodies of every request received, read eagerly because the request is disposed after sending.</summary>
    public List<string> Bodies { get; } = [];

    /// <summary>A handler that answers with JSON and 200 OK.</summary>
    /// <param name="json">The body.</param>
    public static StubHttpMessageHandler Json(string json) =>
        new(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json"),
        });

    /// <summary>A handler that answers with a bare status code.</summary>
    /// <param name="status">The status code.</param>
    public static StubHttpMessageHandler Status(HttpStatusCode status) =>
        new(_ => new HttpResponseMessage(status));

    /// <inheritdoc />
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        Bodies.Add(request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken));
        return _respond(request);
    }
}
