using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using Portfolio.Blazor.Components;

namespace Portfolio.Blazor.Sections;

/// <summary>
/// Code-behind for Selected Work: opens the kiosk dialog, and keeps the FHIR API card's accordion in
/// step with the visitor's toggles and with "#fhir-api" in the URL through site.js. The explorer
/// component renders once the accordion has opened and stays after it closes.
/// </summary>
public sealed partial class PortfolioSection : IAsyncDisposable
{
    /// <summary>The URL fragment that opens the FHIR API card, the target of the Healthcare chip and the old /fhir redirect.</summary>
    public const string FHIR_HASH = "#fhir-api";

    private KioskDialog? _kiosk;
    private ElementReference _fhirCard;
    private ElementReference _fhirAccordion;
    private bool _fhirOpen;
    private bool _fhirLoaded;
    private DotNetObjectReference<PortfolioSection>? _self;
    private IJSObjectReference? _module;
    private IJSObjectReference? _toggleWatch;
    private IJSObjectReference? _hashWatch;

    [Inject]
    private IJSRuntime Js { get; set; } = null!;

    /// <summary>True while the FHIR API card's accordion is open.</summary>
    public bool FhirOpen => _fhirOpen;

    /// <summary>
    /// Called from site.js when the accordion toggles. Opening hides the card's image, so the body jumps
    /// up and the explorer unfolds below the fold; scrolling the card to the top of the viewport keeps
    /// the whole thing in view. The stylesheet's scroll-padding-top clears the header and
    /// prefers-reduced-motion drops the glide.
    /// </summary>
    /// <param name="open">The native element's open state after the toggle.</param>
    [JSInvokable]
    public async Task OnToggled(bool open)
    {
        SetFhirOpen(open);
        StateHasChanged();
        if (open && _module is not null)
        {
            await _module.InvokeVoidAsync("scrollIntoView", _fhirCard);
        }
    }

    /// <summary>Called from site.js when the page is on, or moves to, "#fhir-api"; the browser scrolls to the card on its own, and the toggle scrolls again.</summary>
    [JSInvokable]
    public void OnHashMatched()
    {
        SetFhirOpen(true);
        StateHasChanged();
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        foreach (var watch in new[] { _toggleWatch, _hashWatch })
        {
            if (watch is not null)
            {
                await watch.InvokeVoidAsync("dispose");
                await watch.DisposeAsync();
            }
        }

        if (_module is not null)
        {
            await _module.DisposeAsync();
        }

        _self?.Dispose();
    }

    /// <inheritdoc />
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!firstRender)
        {
            return;
        }

        _self = DotNetObjectReference.Create(this);
        _module = await Js.InvokeAsync<IJSObjectReference>("import", "./js/site.js");
        _toggleWatch = await _module.InvokeAsync<IJSObjectReference?>("watchDetails", _fhirAccordion, _self, nameof(OnToggled));
        _hashWatch = await _module.InvokeAsync<IJSObjectReference?>("watchHash", _self, FHIR_HASH, nameof(OnHashMatched));
    }

    private void SetFhirOpen(bool open)
    {
        _fhirOpen = open;
        if (open)
        {
            _fhirLoaded = true;
        }
    }

    private Task OpenKioskAsync() => _kiosk?.OpenAsync() ?? Task.CompletedTask;
}
