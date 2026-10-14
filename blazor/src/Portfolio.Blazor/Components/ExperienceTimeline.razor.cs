using System.Text.Json;
using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.Options;
using Portfolio.Blazor.Configurations;
using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Models;

namespace Portfolio.Blazor.Components;

/// <summary>Code-behind for the experience timeline: loads positions and skills, applies the skill filter.</summary>
public sealed partial class ExperienceTimeline : IDisposable
{
    // JsonException covers a host that answers an unknown path with index.html instead of JSON,
    // which is what the dev server does for /api; the seed file takes over in that case too.

    /// <summary>Chips shown before the "+N more" button.</summary>
    private const int VISIBLE_CHIPS = 12;

    /// <summary>Chips named here lead the row in this order, regardless of position count.</summary>
    private static readonly string[] PINNED_SKILLS = ["ASP.NET Web API", "C#", "Claude AI Pair Programming", "Angular", "React"];

    /// <summary>Chips named here go to the end of the row.</summary>
    private static readonly string[] DEMOTED_SKILLS = ["CloudWatch"];

    private readonly CancellationTokenSource _cts = new();
    private IReadOnlyList<Position> _positions = [];
    private IReadOnlyList<Position> _allPositions = [];
    private IReadOnlyList<Skill>? _skills;
    private string? _selectedSkill;
    private bool _loading;
    private bool _allChipsShown;
    private bool _failed;

    [Inject]
    private IExperienceClient Client { get; set; } = null!;

    [Inject]
    private IOptions<SiteOptions> Options { get; set; } = null!;

    private string CountLabel => PositionsLabel(_positions.Count) + (_selectedSkill is null ? string.Empty : " with " + _selectedSkill);

    private string JsonPath => "/" + Options.Value.ExperienceApiBase + "/experience" + (_selectedSkill is null ? string.Empty : "?skill=" + Uri.EscapeDataString(_selectedSkill));

    /// <inheritdoc />
    public void Dispose()
    {
        _cts.Cancel();
        _cts.Dispose();
    }

    /// <inheritdoc />
    protected override async Task OnInitializedAsync()
    {
        try
        {
            var list = await Client.GetExperienceAsync(null, _cts.Token);
            if (list.Items.Count == 0)
            {
                throw new HttpRequestException("The API returned no positions.");
            }

            _allPositions = list.Items;
            _positions = list.Items;

            var skills = await Client.GetSkillsAsync(_cts.Token);
            if (skills.Items.Count > 0)
            {
                _skills = OrderChips(skills.Items);
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            if (_positions.Count == 0)
            {
                await LoadSeedAsync();
            }
        }
    }

    private static string PositionsLabel(int count) => count == 1 ? "1 position" : $"{count} positions";

    private static IReadOnlyList<Skill> OrderChips(IReadOnlyList<Skill> skills)
    {
        var pinned = PINNED_SKILLS.SelectMany(name => skills.Where(s => string.Equals(s.Name, name, StringComparison.Ordinal)));
        var demoted = DEMOTED_SKILLS.SelectMany(name => skills.Where(s => string.Equals(s.Name, name, StringComparison.Ordinal)));
        var rest = skills.Where(s => !PINNED_SKILLS.Contains(s.Name, StringComparer.Ordinal) && !DEMOTED_SKILLS.Contains(s.Name, StringComparer.Ordinal));
        return [.. pinned, .. rest, .. demoted];
    }

    private async Task LoadSeedAsync()
    {
        try
        {
            _positions = await Client.GetSeedAsync(_cts.Token);
            _allPositions = _positions;
            _failed = _positions.Count == 0;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _failed = true;
        }
    }

    private string Pressed(string? skill) => string.Equals(_selectedSkill, skill, StringComparison.Ordinal) ? "true" : "false";

    private async Task SelectAsync(string? skill)
    {
        _loading = true;
        try
        {
            _positions = skill is null ? _allPositions : (await Client.GetExperienceAsync(skill, _cts.Token)).Items;
            _selectedSkill = skill;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _positions = _allPositions;
            _selectedSkill = null;
        }
        finally
        {
            _loading = false;
        }
    }

    private void ShowAllChips() => _allChipsShown = true;
}
