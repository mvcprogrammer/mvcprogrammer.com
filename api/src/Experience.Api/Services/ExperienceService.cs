using Experience.Api.Data;
using Experience.Api.Models;

namespace Experience.Api.Services;

public sealed class ExperienceService(IExperienceRepository repository) : IExperienceService
{
    public async Task<PositionList> ListPositionsAsync(string? skill, CancellationToken cancellationToken)
    {
        var positions = NewestFirst(await repository.ListAsync(cancellationToken));

        if (string.IsNullOrWhiteSpace(skill))
        {
            return new PositionList(positions.Count, positions);
        }

        var matching = positions
            .Where(p => p.Skills.Any(s => string.Equals(s, skill, StringComparison.OrdinalIgnoreCase)))
            .ToArray();

        return new PositionList(matching.Length, matching) { Filter = new PositionFilter(skill) };
    }

    public Task<Position?> GetPositionAsync(string id, CancellationToken cancellationToken) =>
        repository.GetAsync(id, cancellationToken);

    public async Task<SkillList> ListSkillsAsync(CancellationToken cancellationToken)
    {
        var positions = NewestFirst(await repository.ListAsync(cancellationToken));
        var skills = Aggregate(positions);
        return new SkillList(skills.Count, skills);
    }

    /// <summary>Start date descending, then id, so equal months are stable.</summary>
    internal static IReadOnlyList<Position> NewestFirst(IEnumerable<Position> positions) =>
        positions
            .OrderByDescending(p => p.StartDate, StringComparer.Ordinal)
            .ThenBy(p => p.Id, StringComparer.Ordinal)
            .ToArray();

    /// <summary>
    /// Groups skills case-insensitively, keeping the casing from the newest position that lists
    /// each one. Position ids within a skill keep the newest-first order of the input.
    /// </summary>
    internal static IReadOnlyList<Skill> Aggregate(IReadOnlyList<Position> newestFirst)
    {
        var byName = new Dictionary<string, (string Name, List<string> Ids)>(StringComparer.OrdinalIgnoreCase);

        foreach (var position in newestFirst)
        {
            foreach (var skill in position.Skills)
            {
                if (!byName.TryGetValue(skill, out var entry))
                {
                    entry = (skill, []);
                    byName[skill] = entry;
                }

                if (!entry.Ids.Contains(position.Id))
                {
                    entry.Ids.Add(position.Id);
                }
            }
        }

        return byName.Values
            .Select(e => new Skill(e.Name, e.Ids.Count, e.Ids))
            .OrderByDescending(s => s.PositionCount)
            .ThenBy(s => s.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }
}
