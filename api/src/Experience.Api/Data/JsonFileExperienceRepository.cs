using System.Text.Json;
using Api.Shared.Http;
using Experience.Api.Models;

namespace Experience.Api.Data;

/// <summary>
/// Serves positions from seed/positions.json. Used when TABLE_NAME is not set, which means
/// local `dotnet run` and the test suite. The same file seeds DynamoDB (see Experience.Seed).
/// </summary>
public sealed class JsonFileExperienceRepository : IExperienceRepository
{
    private readonly Lazy<IReadOnlyList<Position>> _positions;

    public JsonFileExperienceRepository(string path)
    {
        _positions = new Lazy<IReadOnlyList<Position>>(() => Load(path));
    }

    public static IReadOnlyList<Position> Load(string path)
    {
        using var stream = File.OpenRead(path);
        return JsonSerializer.Deserialize<List<Position>>(stream, ApiJson.OPTIONS)
               ?? throw new InvalidDataException($"'{path}' did not contain a JSON array of positions.");
    }

    /// <summary>Walks up from the running assembly to find seed/positions.json in the api folder.</summary>
    public static string? Locate()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "seed", "positions.json");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    public Task<IReadOnlyList<Position>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult(_positions.Value);

    public Task<Position?> GetAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(_positions.Value.FirstOrDefault(p => p.Id == id));

    public Task CreateAsync(Position position, CancellationToken cancellationToken) =>
        throw new NotImplementedException("The JSON file store is read-only.");

    public Task<bool> UpdateAsync(Position position, CancellationToken cancellationToken) =>
        throw new NotImplementedException("The JSON file store is read-only.");

    public Task<bool> DeleteAsync(string id, CancellationToken cancellationToken) =>
        throw new NotImplementedException("The JSON file store is read-only.");
}
