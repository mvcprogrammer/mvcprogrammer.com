using System.Net.Http;
using System.Text.Json;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.Extensions.DependencyInjection;
using Portfolio.Blazor.Components;
using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Models;
using Portfolio.Blazor.Tests.Fakes;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Components;

/// <summary>Tests for <see cref="ExperienceTimeline"/>: loading, fallback, and the skill filter.</summary>
public sealed class ExperienceTimelineTests : BunitContext
{
    #region OnInitializedAsync Tests

    /// <summary>With the API answering, the timeline renders every position and the filter appears.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldRenderPositionsAndSkillFilterFromApi()
    {
        // Arrange
        var client = Arrange_ApiAnswers(TestData.CreatePositionList(), TestData.CreateSkillList("C#", "Angular"));

        // Act
        var cut = Render<ExperienceTimeline>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal(2, cut.FindAll(".timeline-item").Count));
        Assert.False(cut.Find("#skill-filter").HasAttribute("hidden"), "the filter shows once skills are loaded");
        Assert.Equal(["All", "C#", "Angular"], cut.FindAll(".skill-chip").Select(c => c.TextContent));
        Assert.Equal("2 positions", cut.Find(".skill-filter-count").TextContent);
        Assert.Equal([null], client.ExperienceCalls);
        Assert.Equal(1, client.SkillsCalls);
        Assert.Equal(0, client.SeedCalls);
    }

    /// <summary>Dates render as "Mon yyyy", a missing end date as "Present", and the place label follows the work mode.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldTransformDatesAndPlace()
    {
        // Arrange
        var current = TestData.CreatePosition(endDate: null);
        var onSite = TestData.CreatePosition(id: "tops", startDate: "2020-02", endDate: "2022-08", workMode: Enumerations.WorkMode.OnSite, location: "Florida");
        Arrange_ApiAnswers(new PositionList(2, [current, onSite]), TestData.CreateSkillList("C#"));

        // Act
        var cut = Render<ExperienceTimeline>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal(2, cut.FindAll(".timeline-item").Count));
        var dates = cut.FindAll(".timeline-date").Select(d => string.Join(' ', d.TextContent.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))).ToList();
        Assert.Equal("Dec 2023 – Present · Remote", dates[0]);
        Assert.Equal("Feb 2020 – Aug 2022 · Florida", dates[1]);
        Assert.Equal("2023-12", cut.Find("time").GetAttribute("datetime"));
    }

    /// <summary>When the API throws, the timeline renders from the seed and the filter stays hidden.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldFallBackToSeedWhenApiFails()
    {
        // Arrange
        var client = Arrange_ApiFails(new HttpRequestException("down"));

        // Act
        var cut = Render<ExperienceTimeline>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Single(cut.FindAll(".timeline-item")));
        Assert.True(cut.Find("#skill-filter").HasAttribute("hidden"), "no skills without the API");
        Assert.Equal(1, client.SeedCalls);
        Assert.Empty(cut.FindAll(".form-status"));
    }

    /// <summary>A host that answers /api with HTML (the dev server) causes a JsonException, which also falls back to the seed.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldFallBackToSeedWhenResponseIsNotJson()
    {
        // Arrange
        var client = Arrange_ApiFails(new JsonException("'<' is an invalid start of a value"));

        // Act
        var cut = Render<ExperienceTimeline>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Single(cut.FindAll(".timeline-item")));
        Assert.Equal(1, client.SeedCalls);
    }

    /// <summary>A cancelled or timed-out API call falls back to the seed too.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldFallBackToSeedWhenApiTimesOut()
    {
        // Arrange
        var client = Arrange_ApiFails(new TaskCanceledException("timeout"));

        // Act
        var cut = Render<ExperienceTimeline>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Single(cut.FindAll(".timeline-item")));
        Assert.Equal(1, client.SeedCalls);
    }

    /// <summary>An empty API answer counts as a failure and falls back to the seed.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldFallBackToSeedWhenApiReturnsNoPositions()
    {
        // Arrange
        var client = Arrange_ApiAnswers(new PositionList(0, []), TestData.CreateSkillList("C#"));
        client.OnGetSeed = () => Task.FromResult<IReadOnlyList<Position>>([TestData.CreatePosition()]);

        // Act
        var cut = Render<ExperienceTimeline>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Single(cut.FindAll(".timeline-item")));
        Assert.Equal(1, client.SeedCalls);
        Assert.Equal(0, client.SkillsCalls);
    }

    /// <summary>When the seed is unreachable as well, the component says so and links to the resume.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldShowErrorWhenSeedFailsToo()
    {
        // Arrange
        var client = Arrange_ApiFails(new HttpRequestException("down"));
        client.OnGetSeed = () => throw new HttpRequestException("also down");

        // Act
        var cut = Render<ExperienceTimeline>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Single(cut.FindAll(".form-status.is-error")));
        Assert.Empty(cut.FindAll(".timeline-item"));
        Assert.Equal("https://resume.example.test/", cut.Find(".form-status a").GetAttribute("href"));
    }

    /// <summary>Positions loaded but no skills: the timeline shows and the filter stays hidden.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldHideFilterWhenSkillsAreEmpty()
    {
        // Arrange
        Arrange_ApiAnswers(TestData.CreatePositionList(), new SkillList(0, []));

        // Act
        var cut = Render<ExperienceTimeline>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal(2, cut.FindAll(".timeline-item").Count));
        Assert.True(cut.Find("#skill-filter").HasAttribute("hidden"), "an empty skill list keeps the filter hidden");
    }

    #endregion

    #region Skill Chip Tests

    /// <summary>Pinned skills lead the row in their fixed order, demoted ones trail, and the rest keep API order.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldOrderChipsPinnedThenRestThenDemoted()
    {
        // Arrange
        Arrange_ApiAnswers(TestData.CreatePositionList(), TestData.CreateSkillList("CloudWatch", "SQL Server", "Angular", "AWS", "C#"));

        // Act
        var cut = Render<ExperienceTimeline>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal(6, cut.FindAll(".skill-chip").Count));
        Assert.Equal(["All", "C#", "Angular", "SQL Server", "AWS", "CloudWatch"], cut.FindAll(".skill-chip").Select(c => c.TextContent));
    }

    /// <summary>Past twelve skills, the rest hide behind a "+N more" chip that reveals them and removes itself.</summary>
    [Fact]
    public async Task ShowAllChips_ShouldRevealHiddenChips()
    {
        // Arrange
        var names = Enumerable.Range(1, 15).Select(i => $"Skill {i:00}").ToArray();
        Arrange_ApiAnswers(TestData.CreatePositionList(), TestData.CreateSkillList(names));
        var cut = Render<ExperienceTimeline>();
        await cut.WaitForAssertionAsync(() => Assert.Single(cut.FindAll(".skill-chip-more")));
        Assert.Equal("+3 more", cut.Find(".skill-chip-more").TextContent);
        Assert.Equal(3, cut.FindAll(".skill-chip[hidden]").Count);

        // Act
        await cut.Find(".skill-chip-more").ClickAsync(new MouseEventArgs());

        // Assert
        Assert.Empty(cut.FindAll(".skill-chip[hidden]"));
        Assert.Empty(cut.FindAll(".skill-chip-more"));
    }

    /// <summary>Each skill chip's tooltip states how many positions list it.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldTitleChipsWithPositionCount()
    {
        // Arrange
        Arrange_ApiAnswers(TestData.CreatePositionList(), new SkillList(2, [new Skill("C#", 2, ["a", "b"]), new Skill("Angular", 1, ["a"])]));

        // Act
        var cut = Render<ExperienceTimeline>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal(3, cut.FindAll(".skill-chip").Count));
        var chips = cut.FindAll(".skill-chip");
        Assert.Equal("2 positions", chips[1].GetAttribute("title"));
        Assert.Equal("1 position", chips[2].GetAttribute("title"));
    }

    #endregion

    #region SelectAsync Tests

    /// <summary>Clicking a chip asks the API for that skill, re-renders, presses the chip, and updates the count and link.</summary>
    [Fact]
    public async Task SelectAsync_ShouldFilterBySkill()
    {
        // Arrange
        var client = Arrange_ApiAnswers(TestData.CreatePositionList(), TestData.CreateSkillList("C#", "Angular"));
        client.OnGetExperience = skill => Task.FromResult(skill is null
            ? TestData.CreatePositionList()
            : new PositionList(1, [TestData.CreatePosition(skills: [skill])]));
        var cut = Render<ExperienceTimeline>();
        await cut.WaitForAssertionAsync(() => Assert.Equal(3, cut.FindAll(".skill-chip").Count));

        // Act
        await cut.FindAll(".skill-chip")[1].ClickAsync(new MouseEventArgs());

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Single(cut.FindAll(".timeline-item")));
        Assert.Equal([null, "C#"], client.ExperienceCalls);
        Assert.Equal("true", cut.FindAll(".skill-chip")[1].GetAttribute("aria-pressed"));
        Assert.Equal("false", cut.FindAll(".skill-chip")[0].GetAttribute("aria-pressed"));
        Assert.Equal("1 position with C#", cut.Find(".skill-filter-count").TextContent);
        Assert.Equal("/api/experience?skill=C%23", cut.Find(".skill-filter-link").GetAttribute("href"));
        Assert.DoesNotContain("is-loading", cut.Find(".timeline").ClassList);
    }

    /// <summary>"All" restores the cached full list without another API call.</summary>
    [Fact]
    public async Task SelectAsync_ShouldRestoreAllPositionsWithoutRefetching()
    {
        // Arrange
        var client = Arrange_ApiAnswers(TestData.CreatePositionList(), TestData.CreateSkillList("C#"));
        client.OnGetExperience = skill => Task.FromResult(skill is null ? TestData.CreatePositionList() : new PositionList(1, [TestData.CreatePosition()]));
        var cut = Render<ExperienceTimeline>();
        await cut.WaitForAssertionAsync(() => Assert.Equal(2, cut.FindAll(".skill-chip").Count));
        await cut.FindAll(".skill-chip")[1].ClickAsync(new MouseEventArgs());
        await cut.WaitForAssertionAsync(() => Assert.Single(cut.FindAll(".timeline-item")));

        // Act
        await cut.FindAll(".skill-chip")[0].ClickAsync(new MouseEventArgs());

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal(2, cut.FindAll(".timeline-item").Count));
        Assert.Equal([null, "C#"], client.ExperienceCalls);
        Assert.Equal("true", cut.FindAll(".skill-chip")[0].GetAttribute("aria-pressed"));
        Assert.Equal("/api/experience", cut.Find(".skill-filter-link").GetAttribute("href"));
    }

    /// <summary>A failed filter request leaves the full list in place with "All" pressed.</summary>
    [Fact]
    public async Task SelectAsync_ShouldFallBackToAllPositionsWhenFilterFails()
    {
        // Arrange
        var client = Arrange_ApiAnswers(TestData.CreatePositionList(), TestData.CreateSkillList("C#"));
        var cut = Render<ExperienceTimeline>();
        await cut.WaitForAssertionAsync(() => Assert.Equal(2, cut.FindAll(".skill-chip").Count));
        client.OnGetExperience = _ => throw new HttpRequestException("down");

        // Act
        await cut.FindAll(".skill-chip")[1].ClickAsync(new MouseEventArgs());

        // Assert
        Assert.Equal(2, cut.FindAll(".timeline-item").Count);
        Assert.Equal("true", cut.FindAll(".skill-chip")[0].GetAttribute("aria-pressed"));
        Assert.Equal("2 positions", cut.Find(".skill-filter-count").TextContent);
    }

    #endregion

    #region Dispose Tests

    /// <summary>Disposing the component while a request is in flight cancels it rather than throwing.</summary>
    [Fact]
    public async Task Dispose_ShouldCancelPendingRequest()
    {
        // Arrange
        var started = new TaskCompletionSource();
        var client = new FakeExperienceClient
        {
            OnGetExperience = _ => { started.SetResult(); return new TaskCompletionSource<PositionList>().Task; },
        };
        Services.AddSingleton<IExperienceClient>(client);
        this.AddSiteOptions();
        var cut = Render<ExperienceTimeline>();
        await started.Task;

        // Act
        var exception = await Record.ExceptionAsync(() => DisposeComponentsAsync());

        // Assert
        Assert.Null(exception);
    }

    #endregion

    #region Helper Methods

    private FakeExperienceClient Arrange_ApiAnswers(PositionList positions, SkillList skills)
    {
        var client = new FakeExperienceClient
        {
            OnGetExperience = _ => Task.FromResult(positions),
            OnGetSkills = () => Task.FromResult(skills),
            OnGetSeed = () => Task.FromResult<IReadOnlyList<Position>>([TestData.CreatePosition()]),
        };
        Services.AddSingleton<IExperienceClient>(client);
        this.AddSiteOptions();
        return client;
    }

    private FakeExperienceClient Arrange_ApiFails(Exception exception)
    {
        var client = new FakeExperienceClient
        {
            OnGetExperience = _ => throw exception,
            OnGetSeed = () => Task.FromResult<IReadOnlyList<Position>>([TestData.CreatePosition()]),
        };
        Services.AddSingleton<IExperienceClient>(client);
        this.AddSiteOptions();
        return client;
    }

    #endregion
}
