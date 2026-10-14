using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Portfolio.Blazor.Components;

/// <summary>Code-behind for the site header: menu state, scroll shadow, and the current-section highlight.</summary>
public sealed partial class SiteHeader : IAsyncDisposable
{
    private static readonly SectionLink[] SECTION_LINKS =
    [
        new("about", "About"),
        new("services", "Employers"),
        new("freelance", "Freelance"),
        new("portfolio", "Portfolio"),
        new("resume", "Resume"),
        new("contact", "Contact"),
    ];

    private ElementReference _header;
    private ElementReference _toggle;
    private bool _menuOpen;
    private bool _scrolled;
    private string? _current;
    private DotNetObjectReference<SiteHeader>? _self;
    private IJSObjectReference? _module;
    private IJSObjectReference? _headerWatch;
    private IJSObjectReference? _sectionWatch;
    private IJSObjectReference? _menuWatch;

    [Inject]
    private IJSRuntime Js { get; set; } = null!;

    /// <summary>Called from site.js when the page crosses the scroll threshold.</summary>
    /// <param name="scrolled">True when the page is scrolled past the header.</param>
    [JSInvokable]
    public void SetScrolled(bool scrolled)
    {
        if (_scrolled == scrolled)
        {
            return;
        }

        _scrolled = scrolled;
        StateHasChanged();
    }

    /// <summary>Called from site.js when a different section becomes the most visible one.</summary>
    /// <param name="sectionId">The section's element id, or null near the top of the page.</param>
    [JSInvokable]
    public void SetCurrentSection(string? sectionId)
    {
        _current = sectionId;
        StateHasChanged();
    }

    /// <summary>Closes the mobile menu. Called from nav links and from site.js (Escape, outside click, resize).</summary>
    /// <param name="returnFocus">True to move focus back to the toggle button, as Escape should.</param>
    [JSInvokable]
    public async Task CloseMenu(bool returnFocus)
    {
        if (!_menuOpen)
        {
            return;
        }

        _menuOpen = false;
        StateHasChanged();

        if (returnFocus && _module is not null)
        {
            await _module.InvokeVoidAsync("focus", _toggle);
        }
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        await DisposeHandleAsync(_menuWatch);
        await DisposeHandleAsync(_sectionWatch);
        await DisposeHandleAsync(_headerWatch);

        if (_module is not null)
        {
            await _module.DisposeAsync();
        }

        _self?.Dispose();
    }

    /// <inheritdoc />
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            _self = DotNetObjectReference.Create(this);
            _module = await Js.InvokeAsync<IJSObjectReference>("import", "./js/site.js");
            _headerWatch = await _module.InvokeAsync<IJSObjectReference>("watchHeader", _self);
            _sectionWatch = await _module.InvokeAsync<IJSObjectReference?>("observeSections", _self, SECTION_LINKS.Select(l => l.Id).ToArray());
        }

        // The document-level listeners exist only while the menu is open.
        if (_menuOpen && _menuWatch is null && _module is not null)
        {
            _menuWatch = await _module.InvokeAsync<IJSObjectReference>("watchMenu", _self, _header);
        }
        else if (!_menuOpen && _menuWatch is not null)
        {
            var watch = _menuWatch;
            _menuWatch = null;
            await DisposeHandleAsync(watch);
        }
    }

    private static async Task DisposeHandleAsync(IJSObjectReference? handle)
    {
        if (handle is null)
        {
            return;
        }

        await handle.InvokeVoidAsync("dispose");
        await handle.DisposeAsync();
    }

    private bool IsCurrent(string sectionId) => string.Equals(_current, sectionId, StringComparison.Ordinal);

    private void ToggleMenu() => _menuOpen = !_menuOpen;

    /// <summary>A nav entry: the section id it scrolls to and its label.</summary>
    private sealed record SectionLink(string Id, string Label);
}
