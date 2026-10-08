using Amazon.DynamoDBv2.Model;
using Experience.Api.Models;

namespace Experience.Api.Data;

/// <summary>
/// Hand-rolled mapping between <see cref="Position"/> and a DynamoDB item.
/// Single-table layout: PK = "RESUME", SK = "POSITION#{id}". Positions are few, so they
/// are sorted by start date in code rather than encoded into the sort key.
/// </summary>
public static class PositionMapper
{
    public const string PartitionKey = "RESUME";
    public const string SortKeyPrefix = "POSITION#";

    public static Dictionary<string, AttributeValue> Key(string id) => new()
    {
        ["PK"] = new AttributeValue(PartitionKey),
        ["SK"] = new AttributeValue(SortKeyPrefix + id),
    };

    public static Dictionary<string, AttributeValue> ToItem(Position p)
    {
        var item = Key(p.Id);
        item["type"] = new AttributeValue("position");
        item["id"] = new AttributeValue(p.Id);
        item["title"] = new AttributeValue(p.Title);
        item["organization"] = new AttributeValue(p.Organization);
        item["startDate"] = new AttributeValue(p.StartDate);
        item["endDate"] = p.EndDate is null ? new AttributeValue { NULL = true } : new AttributeValue(p.EndDate);
        item["workMode"] = new AttributeValue(WorkModes.ToWire(p.WorkMode));
        item["location"] = new AttributeValue(p.Location);
        item["highlights"] = StringList(p.Highlights);
        item["skills"] = StringList(p.Skills);
        return item;
    }

    public static Position FromItem(IReadOnlyDictionary<string, AttributeValue> item) => new(
        Id: Required(item, "id"),
        Title: Required(item, "title"),
        Organization: Required(item, "organization"),
        StartDate: Required(item, "startDate"),
        EndDate: item.TryGetValue("endDate", out var end) && end.NULL != true ? end.S : null,
        WorkMode: WorkModes.FromWire(Required(item, "workMode")),
        Location: item.TryGetValue("location", out var loc) ? loc.S ?? "" : "",
        Highlights: Strings(item, "highlights"),
        Skills: Strings(item, "skills"));

    private static AttributeValue StringList(IEnumerable<string> values) =>
        new() { L = values.Select(v => new AttributeValue(v)).ToList(), IsLSet = true };

    private static string Required(IReadOnlyDictionary<string, AttributeValue> item, string name) =>
        item.TryGetValue(name, out var value) && value.S is { } s
            ? s
            : throw new InvalidDataException($"DynamoDB item is missing string attribute '{name}'.");

    private static IReadOnlyList<string> Strings(IReadOnlyDictionary<string, AttributeValue> item, string name) =>
        item.TryGetValue(name, out var value) && value.L is { } list
            ? list.Select(v => v.S ?? "").ToArray()
            : [];
}

/// <summary>Wire form of <see cref="WorkMode"/>, shared by DynamoDB and JSON: remote, hybrid, on-site.</summary>
public static class WorkModes
{
    public static string ToWire(WorkMode mode) => mode switch
    {
        WorkMode.Remote => "remote",
        WorkMode.Hybrid => "hybrid",
        WorkMode.OnSite => "on-site",
        _ => throw new ArgumentOutOfRangeException(nameof(mode), mode, null),
    };

    public static WorkMode FromWire(string value) => value switch
    {
        "remote" => WorkMode.Remote,
        "hybrid" => WorkMode.Hybrid,
        "on-site" => WorkMode.OnSite,
        _ => throw new InvalidDataException($"Unknown workMode '{value}'."),
    };
}
