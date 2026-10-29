using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.Options;
using Portfolio.Blazor.Components;
using Portfolio.Blazor.Configurations;

namespace Portfolio.Blazor.Sections;

/// <summary>Code-behind for Selected Work: opens the kiosk demo and the patient explorer in their dialogs.</summary>
public sealed partial class PortfolioSection
{
    private DemoDialog? _kiosk;
    private DemoDialog? _fhirExplorer;

    [Inject]
    private IOptions<SiteOptions> Options { get; set; } = null!;

    private Task OpenKioskAsync() => _kiosk?.OpenAsync() ?? Task.CompletedTask;

    private Task OpenFhirExplorerAsync() => _fhirExplorer?.OpenAsync() ?? Task.CompletedTask;
}
