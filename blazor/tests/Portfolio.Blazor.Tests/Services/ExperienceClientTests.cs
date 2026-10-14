using System.Net;
using System.Net.Http;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Portfolio.Blazor.Enumerations;
using Portfolio.Blazor.Services;
using Portfolio.Blazor.Tests.Fakes;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Services;

/// <summary>Tests for <see cref="ExperienceClient"/> over a stubbed HTTP handler.</summary>
public sealed class ExperienceClientTests
{
    private const string POSITIONS_JSON = """
        {"count":1,"items":[{"id":"advancedmd","title":"Senior Software Engineer","organization":"AdvancedMD","startDate":"2023-12","endDate":null,"workMode":"on-site","location":"Florida","highlights":["Did the work."],"skills":["C#"]}]}
        """;

    #region Constructor Tests

    /// <summary>Constructor arguments are guarded.</summary>
    [Fact]
    public void ExperienceClient_ShouldThrowOnNullArguments()
    {
        // Arrange
        using var http = new HttpClient();
        var options = Options.Create(BunitContextExtensions.CreateSiteOptions());

        // Act and Assert
        Assert.Throws<ArgumentNullException>(() => new ExperienceClient(null!, options));
        Assert.Throws<ArgumentNullException>(() => new ExperienceClient(http, null!));
    }

    #endregion

    #region GetExperienceAsync Tests

    /// <summary>Without a skill the client calls the collection and maps the camelCase, kebab-case JSON.</summary>
    [Fact]
    public async Task GetExperienceAsync_ShouldRequestCollectionAndDeserialize()
    {
        // Arrange
        var handler = StubHttpMessageHandler.Json(POSITIONS_JSON);
        var client = CreateClient(handler);

        // Act
        var list = await client.GetExperienceAsync(null, CancellationToken.None);

        // Assert
        Assert.Equal("https://site.example.test/api/experience", Assert.Single(handler.Requests).RequestUri?.ToString());
        var position = Assert.Single(list.Items);
        Assert.Equal("advancedmd", position.Id);
        Assert.Null(position.EndDate);
        Assert.Equal(WorkMode.OnSite, position.WorkMode);
        Assert.Equal(["C#"], position.Skills);
    }

    /// <summary>A skill becomes an escaped query string parameter.</summary>
    [Fact]
    public async Task GetExperienceAsync_ShouldEscapeSkillInQueryString()
    {
        // Arrange
        var handler = StubHttpMessageHandler.Json(POSITIONS_JSON);
        var client = CreateClient(handler);

        // Act
        await client.GetExperienceAsync("C# / .NET", CancellationToken.None);

        // Assert (AbsoluteUri keeps the escaping; ToString() would unescape the spaces)
        Assert.Equal("https://site.example.test/api/experience?skill=C%23%20%2F%20.NET", Assert.Single(handler.Requests).RequestUri?.AbsoluteUri);
    }

    /// <summary>Blank skills are treated as no filter.</summary>
    [Fact]
    public async Task GetExperienceAsync_ShouldIgnoreBlankSkill()
    {
        // Arrange
        var handler = StubHttpMessageHandler.Json(POSITIONS_JSON);
        var client = CreateClient(handler);

        // Act
        await client.GetExperienceAsync("  ", CancellationToken.None);

        // Assert
        Assert.Equal("https://site.example.test/api/experience", Assert.Single(handler.Requests).RequestUri?.ToString());
    }

    /// <summary>An error status surfaces as HttpRequestException carrying the code.</summary>
    [Fact]
    public async Task GetExperienceAsync_ShouldThrowHttpRequestExceptionOnErrorStatus()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Status(HttpStatusCode.BadGateway));

        // Act
        var exception = await Assert.ThrowsAsync<HttpRequestException>(() => client.GetExperienceAsync(null, CancellationToken.None));

        // Assert
        Assert.Equal(HttpStatusCode.BadGateway, exception.StatusCode);
    }

    /// <summary>HTML where JSON was expected (a SPA fallback page) surfaces as JsonException.</summary>
    [Fact]
    public async Task GetExperienceAsync_ShouldThrowJsonExceptionOnHtml()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Json("<!DOCTYPE html><html></html>"));

        // Act and Assert
        await Assert.ThrowsAsync<JsonException>(() => client.GetExperienceAsync(null, CancellationToken.None));
    }

    /// <summary>A JSON null body becomes an empty list rather than a null reference.</summary>
    [Fact]
    public async Task GetExperienceAsync_ShouldReturnEmptyListForNullBody()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Json("null"));

        // Act
        var list = await client.GetExperienceAsync(null, CancellationToken.None);

        // Assert
        Assert.Empty(list.Items);
    }

    /// <summary>A pre-cancelled token aborts the call.</summary>
    [Fact]
    public async Task GetExperienceAsync_ShouldThrowWhenCancelled()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Json(POSITIONS_JSON));
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        // Act and Assert
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.GetExperienceAsync(null, cts.Token));
    }

    #endregion

    #region GetSkillsAsync Tests

    /// <summary>The skills endpoint is read from the configured API base.</summary>
    [Fact]
    public async Task GetSkillsAsync_ShouldRequestSkillsAndDeserialize()
    {
        // Arrange
        var handler = StubHttpMessageHandler.Json("""{"count":1,"items":[{"name":"C#","positionCount":5,"positionIds":["a","b"]}]}""");
        var client = CreateClient(handler);

        // Act
        var skills = await client.GetSkillsAsync(CancellationToken.None);

        // Assert
        Assert.Equal("https://site.example.test/api/skills", Assert.Single(handler.Requests).RequestUri?.ToString());
        var skill = Assert.Single(skills.Items);
        Assert.Equal("C#", skill.Name);
        Assert.Equal(5, skill.PositionCount);
        Assert.Equal(["a", "b"], skill.PositionIds);
    }

    #endregion

    #region GetSeedAsync Tests

    /// <summary>The seed is a bare array at the configured path.</summary>
    [Fact]
    public async Task GetSeedAsync_ShouldRequestSeedPathAndDeserializeArray()
    {
        // Arrange
        var handler = StubHttpMessageHandler.Json("""[{"id":"tops","title":"Software Engineer","organization":"TOPS","startDate":"2020-02","endDate":"2022-08","workMode":"hybrid","location":"Florida","highlights":[],"skills":[]}]""");
        var client = CreateClient(handler);

        // Act
        var seed = await client.GetSeedAsync(CancellationToken.None);

        // Assert
        Assert.Equal("https://site.example.test/data/positions.json", Assert.Single(handler.Requests).RequestUri?.ToString());
        Assert.Equal(WorkMode.Hybrid, Assert.Single(seed).WorkMode);
    }

    #endregion

    #region Helper Methods

    private static ExperienceClient CreateClient(HttpMessageHandler handler)
    {
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://site.example.test/") };
        return new ExperienceClient(http, Options.Create(BunitContextExtensions.CreateSiteOptions()));
    }

    #endregion
}
