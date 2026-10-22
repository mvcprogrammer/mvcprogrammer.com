using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Portfolio.Blazor.Components;

/// <summary>Code-behind for the site header: menu and edition-list state, the theme toggle, scroll shadow, and the current-section highlight.</summary>
public sealed partial class SiteHeader : IAsyncDisposable
{
    /// <summary>The key of the edition this app is; its entry in <see cref="EDITIONS"/> is marked current.</summary>
    private const string CURRENT_EDITION = "blazor";

    /// <summary>The four editions of the site, in the order the edition menu lists them.</summary>
    private static readonly Edition[] EDITIONS =
    [
        new("js", "JS Edition", "https://mvcprogrammer.com/"),
        new("angular", "Angular Edition", "https://angular.mvcprogrammer.com/"),
        new("react", "React Edition", "https://react.mvcprogrammer.com/"),
        new("blazor", "Blazor Edition", "https://blazor.mvcprogrammer.com/"),
    ];

    private static readonly SectionLink[] SECTION_LINKS =
    [
        new("about", "About"),
        new("services", "Employers"),
        new("portfolio", "Portfolio"),
        new("resume", "Resume"),
        new("contact", "Contact"),
    ];

    private ElementReference _header;
    private ElementReference _toggle;
    private ElementReference _edition;
    private ElementReference _editionToggle;
    private bool _menuOpen;
    private bool _editionsOpen;
    private bool _scrolled;
    private string? _current;
    private DotNetObjectReference<SiteHeader>? _self;
    private IJSObjectReference? _module;
    private IJSObjectReference? _headerWatch;
    private IJSObjectReference? _sectionWatch;
    private IJSObjectReference? _menuWatch;
    private IJSObjectReference? _editionWatch;

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

    /// <summary>Closes the edition list. Called from site.js (Escape, outside click, resize).</summary>
    /// <param name="returnFocus">True to move focus back to the edition button, as Escape should.</param>
    [JSInvokable]
    public async Task CloseEditions(bool returnFocus)
    {
        if (!_editionsOpen)
        {
            return;
        }

        _editionsOpen = false;
        StateHasChanged();

        if (returnFocus && _module is not null)
        {
            await _module.InvokeVoidAsync("focus", _editionToggle);
        }
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        await DisposeHandleAsync(_editionWatch);
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

        // The same for the edition list, reporting through CloseEditions.
        if (_editionsOpen && _editionWatch is null && _module is not null)
        {
            _editionWatch = await _module.InvokeAsync<IJSObjectReference>("watchMenu", _self, _edition, nameof(CloseEditions));
        }
        else if (!_editionsOpen && _editionWatch is not null)
        {
            var watch = _editionWatch;
            _editionWatch = null;
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

    private static Edition CurrentEdition => EDITIONS.First(e => e.Key == CURRENT_EDITION);

    private void ToggleMenu() => _menuOpen = !_menuOpen;

    private void ToggleEditions() => _editionsOpen = !_editionsOpen;

    /// <summary>
    /// Flips between light and dark through site.js, which reads what is showing now and saves the
    /// choice for theme.js. The component keeps no theme state: the stylesheet picks the button's icon.
    /// </summary>
    private async Task ToggleThemeAsync()
    {
        if (_module is not null)
        {
            await _module.InvokeVoidAsync("toggleTheme");
        }
    }

    /// <summary>A nav entry: the section id it scrolls to and its label.</summary>
    private sealed record SectionLink(string Id, string Label);

    /// <summary>An edition of the site: its key, the label shown in the edition menu, and where it lives.</summary>
    private sealed record Edition(string Key, string Label, string Href);
}
