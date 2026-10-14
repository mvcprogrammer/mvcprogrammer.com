using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Models;

namespace Portfolio.Blazor.Tests.Fakes;

/// <summary>Scriptable <see cref="IExperienceClient"/>. Each method runs the delegate a test assigns and records its arguments.</summary>
internal sealed class FakeExperienceClient : IExperienceClient
{
    /// <summary>Skill arguments passed to <see cref="GetExperienceAsync"/>, in call order.</summary>
    public List<string?> ExperienceCalls { get; } = [];

    /// <summary>How many times <see cref="GetSkillsAsync"/> ran.</summary>
    public int SkillsCalls { get; private set; }

    /// <summary>How many times <see cref="GetSeedAsync"/> ran.</summary>
    public int SeedCalls { get; private set; }

    /// <summary>Behaviour of <see cref="GetExperienceAsync"/>.</summary>
    public Func<string?, Task<PositionList>> OnGetExperience { get; set; } = _ => Task.FromResult(new PositionList(0, []));

    /// <summary>Behaviour of <see cref="GetSkillsAsync"/>.</summary>
    public Func<Task<SkillList>> OnGetSkills { get; set; } = () => Task.FromResult(new SkillList(0, []));

    /// <summary>Behaviour of <see cref="GetSeedAsync"/>.</summary>
    public Func<Task<IReadOnlyList<Position>>> OnGetSeed { get; set; } = () => Task.FromResult<IReadOnlyList<Position>>([]);

    /// <inheritdoc />
    public Task<PositionList> GetExperienceAsync(string? skill, CancellationToken cancellationToken)
    {
        ExperienceCalls.Add(skill);
        return OnGetExperience(skill);
    }

    /// <inheritdoc />
    public Task<SkillList> GetSkillsAsync(CancellationToken cancellationToken)
    {
        SkillsCalls++;
        return OnGetSkills();
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<Position>> GetSeedAsync(CancellationToken cancellationToken)
    {
        SeedCalls++;
        return OnGetSeed();
    }
}
