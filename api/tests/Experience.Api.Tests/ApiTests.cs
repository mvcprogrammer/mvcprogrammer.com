using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Experience.Api.Http;
using Experience.Api.Models;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Experience.Api.Tests;

/// <summary>End-to-end over the in-process host, reading seed/positions.json.</summary>
public class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Lists_positions_newest_first_with_cache_headers()
    {
        var response = await _client.GetAsync("/api/experience", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(response.Headers.ETag);
        Assert.Equal(CacheableJson.CacheControl, response.Headers.CacheControl?.ToString());

        var list = await response.Content.ReadFromJsonAsync<PositionList>(ApiJson.Options, Ct);
        Assert.NotNull(list);
        Assert.Equal(list.Items.Count, list.Count);
        Assert.Equal(list.Items.OrderByDescending(p => p.StartDate, StringComparer.Ordinal).Select(p => p.Id), list.Items.Select(p => p.Id));
        Assert.Null(list.Filter);
    }

    [Fact]
    public async Task Returns_304_when_the_etag_matches()
    {
        var first = await _client.GetAsync("/api/experience", Ct);
        var etag = first.Headers.ETag!.ToString();

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/experience");
        request.Headers.TryAddWithoutValidation("If-None-Match", etag);
        var second = await _client.SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
        Assert.Equal(etag, second.Headers.ETag?.ToString());
        Assert.Empty(await second.Content.ReadAsByteArrayAsync(Ct));
    }

    [Fact]
    public async Task Filters_by_skill_and_echoes_the_filter()
    {
        var list = await _client.GetFromJsonAsync<PositionList>("/api/experience?skill=rabbitmq", ApiJson.Options, Ct);

        Assert.NotNull(list);
        Assert.Equal("rabbitmq", list.Filter?.Skill);
        Assert.All(list.Items, p => Assert.Contains(p.Skills, s => s.Equals("RabbitMQ", StringComparison.OrdinalIgnoreCase)));
        Assert.NotEmpty(list.Items);
    }

    [Fact]
    public async Task Unknown_skill_is_an_empty_list_not_an_error()
    {
        var list = await _client.GetFromJsonAsync<PositionList>("/api/experience?skill=cobol", ApiJson.Options, Ct);

        Assert.NotNull(list);
        Assert.Empty(list.Items);
    }

    [Fact]
    public async Task Overlong_skill_is_a_400_problem()
    {
        var response = await _client.GetAsync("/api/experience?skill=" + new string('x', 61), Ct);

        await AssertProblem(response, HttpStatusCode.BadRequest, "invalid-parameter");
    }

    [Fact]
    public async Task Gets_one_position_by_id()
    {
        var position = await _client.GetFromJsonAsync<Position>("/api/experience/advancedmd", ApiJson.Options, Ct);

        Assert.NotNull(position);
        Assert.Equal("AdvancedMD", position.Organization);
        Assert.Equal(WorkMode.Remote, position.WorkMode);
    }

    [Fact]
    public async Task Unknown_position_is_a_404_problem()
    {
        var response = await _client.GetAsync("/api/experience/acme", Ct);

        var problem = await AssertProblem(response, HttpStatusCode.NotFound, "not-found");
        Assert.Equal("/api/experience/acme", problem.GetProperty("instance").GetString());
    }

    [Fact]
    public async Task Lists_skills_by_count_with_position_ids()
    {
        var skills = await _client.GetFromJsonAsync<SkillList>("/api/skills", ApiJson.Options, Ct);

        Assert.NotNull(skills);
        Assert.Equal(skills.Items.Count, skills.Count);
        var csharp = Assert.Single(skills.Items, s => s.Name == "C#");
        Assert.Equal(5, csharp.PositionCount);
        Assert.Equal(skills.Items.OrderByDescending(s => s.PositionCount).Select(s => s.PositionCount), skills.Items.Select(s => s.PositionCount));
    }

    [Fact]
    public async Task Health_is_never_cached()
    {
        var response = await _client.GetAsync("/api/health", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var health = await response.Content.ReadFromJsonAsync<Health>(ApiJson.Options, Ct);
        Assert.Equal("ok", health?.Status);
    }

    [Theory]
    [InlineData("POST", "/api/experience")]
    [InlineData("PUT", "/api/experience/advancedmd")]
    [InlineData("DELETE", "/api/experience/advancedmd")]
    public async Task Write_endpoints_are_stubbed_as_501(string method, string path)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), path);
        if (method != "DELETE")
        {
            request.Content = JsonContent.Create(new PositionInput("T", "O", "2026-01", null, WorkMode.Remote, "Remote", ["h"], ["C#"]) , options: ApiJson.Options);
        }

        var response = await _client.SendAsync(request, Ct);

        await AssertProblem(response, HttpStatusCode.NotImplemented, "not-implemented");
    }

    [Fact]
    public async Task Unmatched_routes_are_problem_json()
    {
        var response = await _client.GetAsync("/api/nope", Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    private static async Task<JsonElement> AssertProblem(HttpResponseMessage response, HttpStatusCode status, string typeSuffix)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal((int)status, problem.GetProperty("status").GetInt32());
        Assert.EndsWith("/" + typeSuffix, problem.GetProperty("type").GetString());
        return problem;
    }
}
