using Portfolio.Blazor.Enumerations;
using Portfolio.Blazor.Models;

namespace Portfolio.Blazor.Tests.Helpers;

/// <summary>Fixture factories shared by the test classes.</summary>
internal static class TestData
{
    /// <summary>A position with sensible defaults; override what the test cares about.</summary>
    public static Position CreatePosition(
        string id = "advancedmd",
        string title = "Senior Software Engineer",
        string organization = "AdvancedMD",
        string startDate = "2023-12",
        string? endDate = "2026-05",
        WorkMode workMode = WorkMode.Remote,
        string location = "Remote",
        IReadOnlyList<string>? highlights = null,
        IReadOnlyList<string>? skills = null) =>
        new(id, title, organization, startDate, endDate, workMode, location, highlights ?? ["Did the work."], skills ?? ["C#"]);

    /// <summary>Two positions, newest first, as the API returns them.</summary>
    public static PositionList CreatePositionList() =>
        new(2, [CreatePosition(), CreatePosition(id: "tops", title: "Software Engineer", organization: "TOPS Software", startDate: "2020-02", endDate: "2022-08", workMode: WorkMode.OnSite, location: "Florida")]);

    /// <summary>A skill list with the given names, each used by one position.</summary>
    public static SkillList CreateSkillList(params string[] names) =>
        new(names.Length, [.. names.Select(n => new Skill(n, 1, ["advancedmd"]))]);
}
