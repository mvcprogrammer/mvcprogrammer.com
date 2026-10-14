using System.Net;
using System.Net.Http;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Portfolio.Blazor.Requests;
using Portfolio.Blazor.Services;
using Portfolio.Blazor.Tests.Fakes;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Services;

/// <summary>Tests for <see cref="ContactClient"/>.</summary>
public sealed class ContactClientTests
{
    #region Constructor Tests

    /// <summary>Constructor arguments are guarded.</summary>
    [Fact]
    public void ContactClient_ShouldThrowOnNullArguments()
    {
        // Arrange
        using var http = new HttpClient();

        // Act and Assert
        Assert.Throws<ArgumentNullException>(() => new ContactClient(null!, Options.Create(BunitContextExtensions.CreateSiteOptions())));
        Assert.Throws<ArgumentNullException>(() => new ContactClient(http, null!));
    }

    #endregion

    #region SendAsync Tests

    /// <summary>The message is posted as camelCase JSON to the configured endpoint.</summary>
    [Fact]
    public async Task SendAsync_ShouldPostCamelCaseJsonToEndpoint()
    {
        // Arrange
        var handler = StubHttpMessageHandler.Status(HttpStatusCode.OK);
        var client = CreateClient(handler);
        var request = new ContactRequest("Neal", "neal@example.test", "Freelance", "Email", string.Empty, "Hello there.", string.Empty, 4200);

        // Act
        await client.SendAsync(request, CancellationToken.None);

        // Assert
        var sent = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, sent.Method);
        Assert.Equal("https://contact.example.test/", sent.RequestUri?.ToString());
        Assert.Equal("application/json", sent.Content?.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(Assert.Single(handler.Bodies));
        Assert.Equal("Neal", body.RootElement.GetProperty("name").GetString());
        Assert.Equal(4200, body.RootElement.GetProperty("elapsed").GetInt64());
        Assert.Equal("Hello there.", body.RootElement.GetProperty("message").GetString());
    }

    /// <summary>A rejection carries its status code so the form can tell a rate limit from a fault.</summary>
    [Fact]
    public async Task SendAsync_ShouldThrowWithStatusCodeOnRejection()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Status(HttpStatusCode.TooManyRequests));

        // Act
        var exception = await Assert.ThrowsAsync<HttpRequestException>(() => client.SendAsync(CreateRequest(), CancellationToken.None));

        // Assert
        Assert.Equal(HttpStatusCode.TooManyRequests, exception.StatusCode);
    }

    /// <summary>A null request is rejected before anything is sent.</summary>
    [Fact]
    public async Task SendAsync_ShouldThrowOnNullRequest()
    {
        // Arrange
        var handler = StubHttpMessageHandler.Status(HttpStatusCode.OK);
        var client = CreateClient(handler);

        // Act and Assert
        await Assert.ThrowsAsync<ArgumentNullException>(() => client.SendAsync(null!, CancellationToken.None));
        Assert.Empty(handler.Requests);
    }

    /// <summary>A pre-cancelled token aborts the call.</summary>
    [Fact]
    public async Task SendAsync_ShouldThrowWhenCancelled()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Status(HttpStatusCode.OK));
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        // Act and Assert
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.SendAsync(CreateRequest(), cts.Token));
    }

    #endregion

    #region Helper Methods

    private static ContactClient CreateClient(HttpMessageHandler handler) =>
        new(new HttpClient(handler), Options.Create(BunitContextExtensions.CreateSiteOptions()));

    private static ContactRequest CreateRequest() =>
        new("Neal", "neal@example.test", "Freelance", "Email", string.Empty, "Hello there.", string.Empty, 4200);

    #endregion
}
