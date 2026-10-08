using Experience.Api.Data;
using Experience.Api.Models;

namespace Experience.Api.Tests;

public class PositionMapperTests
{
    [Fact]
    public void Round_trips_a_position_through_a_dynamodb_item()
    {
        var original = new Position(
            "tops-software", "Software Engineer", "TOPS Software", "2020-02", "2022-08",
            WorkMode.OnSite, "Florida", ["one", "two"], ["C#", "Angular"]);

        var item = PositionMapper.ToItem(original);
        var restored = PositionMapper.FromItem(item);

        Assert.Equal("RESUME", item["PK"].S);
        Assert.Equal("POSITION#tops-software", item["SK"].S);
        Assert.Equal("on-site", item["workMode"].S);
        Assert.Equal(original, restored with { Highlights = original.Highlights, Skills = original.Skills });
        Assert.Equal(original.Highlights, restored.Highlights);
        Assert.Equal(original.Skills, restored.Skills);
    }

    [Fact]
    public void Stores_a_current_role_with_a_null_end_date()
    {
        var current = new Position("now", "T", "O", "2026-06", null, WorkMode.Remote, "Remote", ["x"], []);

        var item = PositionMapper.ToItem(current);

        Assert.True(item["endDate"].NULL);
        Assert.Null(PositionMapper.FromItem(item).EndDate);
    }

    [Fact]
    public void Rejects_an_item_missing_a_required_attribute()
    {
        var item = PositionMapper.ToItem(new Position("x", "T", "O", "2020-01", null, WorkMode.Hybrid, "FL", ["h"], []));
        item.Remove("title");

        Assert.Throws<InvalidDataException>(() => PositionMapper.FromItem(item));
    }
}
