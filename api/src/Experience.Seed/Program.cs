// Loads seed/positions.json into the DynamoDB table using the same mapper the API reads with.
//
//   dotnet run --project api/src/Experience.Seed -- --table mvcprogrammer-experience [--file path] [--dry-run]
//
// Idempotent: PutItem replaces by key, so re-running after editing the file updates in place.
// It does not delete positions removed from the file; do that by hand, it is a resume.

using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Experience.Api.Data;

var table = Arg("--table") ?? Environment.GetEnvironmentVariable("TABLE_NAME");
var file = Arg("--file") ?? JsonFileExperienceRepository.Locate();
var dryRun = args.Contains("--dry-run");

if (file is null)
{
    Console.Error.WriteLine("No positions file. Pass --file or run from inside the repo.");
    return 2;
}

var positions = JsonFileExperienceRepository.Load(file);
Console.WriteLine($"{positions.Count} positions in {file}");

if (dryRun)
{
    foreach (var p in positions)
    {
        Console.WriteLine($"  {PositionMapper.SortKeyPrefix}{p.Id}  {p.StartDate} .. {p.EndDate ?? "present"}  {p.Title} @ {p.Organization}  ({p.Skills.Count} skills)");
    }

    return 0;
}

if (string.IsNullOrWhiteSpace(table))
{
    Console.Error.WriteLine("No table. Pass --table or set TABLE_NAME.");
    return 2;
}

using var dynamo = new AmazonDynamoDBClient();

// BatchWriteItem takes up to 25 puts; the resume is well under that, but chunk anyway.
foreach (var chunk in positions.Chunk(25))
{
    var request = new BatchWriteItemRequest
    {
        RequestItems = new Dictionary<string, List<WriteRequest>>
        {
            [table] = chunk.Select(p => new WriteRequest(new PutRequest(PositionMapper.ToItem(p)))).ToList(),
        },
    };

    do
    {
        var response = await dynamo.BatchWriteItemAsync(request);
        request.RequestItems = response.UnprocessedItems;
    }
    while (request.RequestItems is { Count: > 0 });
}

Console.WriteLine($"Wrote {positions.Count} positions to {table}.");
return 0;

string? Arg(string name)
{
    var i = Array.IndexOf(args, name);
    return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
}
