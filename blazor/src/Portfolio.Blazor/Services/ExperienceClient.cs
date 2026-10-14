using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using Portfolio.Blazor.Configurations;
using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Models;
using Portfolio.Blazor.Serialization;

namespace Portfolio.Blazor.Services;

/// <summary>Typed HttpClient for the Experience API. The client's base address is the site origin.</summary>
public sealed class ExperienceClient : IExperienceClient
{
    private readonly HttpClient _http;
    private readonly SiteOptions _options;

    /// <summary>Creates the client.</summary>
    /// <param name="http">Client whose base address is the site origin; CloudFront routes /api to the Lambda.</param>
    /// <param name="options">Site endpoints.</param>
    public ExperienceClient(HttpClient http, IOptions<SiteOptions> options)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(options);

        _http = http;
        _options = options.Value;
    }

    /// <inheritdoc />
    public async Task<PositionList> GetExperienceAsync(string? skill, CancellationToken cancellationToken)
    {
        var path = $"{_options.ExperienceApiBase}/experience";
        if (!string.IsNullOrWhiteSpace(skill))
        {
            path += "?skill=" + Uri.EscapeDataString(skill);
        }

        var list = await _http.GetFromJsonAsync(path, PortfolioJsonContext.Default.PositionList, cancellationToken);
        return list ?? new PositionList(0, []);
    }

    /// <inheritdoc />
    public async Task<SkillList> GetSkillsAsync(CancellationToken cancellationToken)
    {
        var list = await _http.GetFromJsonAsync($"{_options.ExperienceApiBase}/skills", PortfolioJsonContext.Default.SkillList, cancellationToken);
        return list ?? new SkillList(0, []);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Position>> GetSeedAsync(CancellationToken cancellationToken)
    {
        var seed = await _http.GetFromJsonAsync(_options.ExperienceSeedPath, PortfolioJsonContext.Default.IReadOnlyListPosition, cancellationToken);
        return seed ?? [];
    }
}
