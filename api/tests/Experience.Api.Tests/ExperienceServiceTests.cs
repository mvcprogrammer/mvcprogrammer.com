using Experience.Api.Models;
using Experience.Api.Services;

namespace Experience.Api.Tests;

public class ExperienceServiceTests
{
    private static Position Make(string id, string start, params string[] skills) =>
        new(id, "Title", "Org", start, null, WorkMode.Remote, "Remote", ["did a thing"], skills);

    [Fact]
    public void NewestFirst_orders_by_start_date_descending_then_id()
    {
        var ordered = ExperienceService.NewestFirst(
        [
            Make("b", "2020-01"),
            Make("a", "2020-01"),
            Make("c", "2023-12"),
        ]);

        Assert.Equal(["c", "a", "b"], ordered.Select(p => p.Id));
    }

    [Fact]
    public void Aggregate_merges_skills_case_insensitively_and_keeps_newest_casing()
    {
        var skills = ExperienceService.Aggregate(
        [
            Make("new", "2023-01", "SQL Server", "C#"),
            Make("old", "2010-01", "sql server", "C++"),
        ]);

        var sql = Assert.Single(skills, s => s.Name == "SQL Server");
        Assert.Equal(2, sql.PositionCount);
        Assert.Equal(["new", "old"], sql.PositionIds);
        Assert.DoesNotContain(skills, s => s.Name == "sql server");
    }

    [Fact]
    public void Aggregate_orders_by_count_then_name()
    {
        var skills = ExperienceService.Aggregate(
        [
            Make("p1", "2023-01", "Zeta", "Alpha", "Shared"),
            Make("p2", "2020-01", "Shared"),
        ]);

        Assert.Equal(["Shared", "Alpha", "Zeta"], skills.Select(s => s.Name));
    }

    [Fact]
    public async Task ListPositions_filters_case_insensitively_and_reports_the_filter()
    {
        var service = new ExperienceService(new StubRepository(
            Make("p1", "2023-01", "RabbitMQ"),
            Make("p2", "2020-01", "Angular")));

        var list = await service.ListPositionsAsync("rabbitmq", CancellationToken.None);

        var only = Assert.Single(list.Items);
        Assert.Equal("p1", only.Id);
        Assert.Equal(1, list.Count);
        Assert.Equal("rabbitmq", list.Filter?.Skill);
    }

    [Fact]
    public async Task ListPositions_without_a_filter_omits_the_filter_block()
    {
        var service = new ExperienceService(new StubRepository(Make("p1", "2023-01", "C#")));

        var list = await service.ListPositionsAsync(null, CancellationToken.None);

        Assert.Single(list.Items);
        Assert.Equal(1, list.Count);
        Assert.Null(list.Filter);
    }

    private sealed class StubRepository(params Position[] positions) : Data.IExperienceRepository
    {
        public Task<IReadOnlyList<Position>> ListAsync(CancellationToken ct) => Task.FromResult<IReadOnlyList<Position>>(positions);
        public Task<Position?> GetAsync(string id, CancellationToken ct) => Task.FromResult(positions.FirstOrDefault(p => p.Id == id));
        public Task CreateAsync(Position position, CancellationToken ct) => throw new NotImplementedException();
        public Task<bool> UpdateAsync(Position position, CancellationToken ct) => throw new NotImplementedException();
        public Task<bool> DeleteAsync(string id, CancellationToken ct) => throw new NotImplementedException();
    }
}
