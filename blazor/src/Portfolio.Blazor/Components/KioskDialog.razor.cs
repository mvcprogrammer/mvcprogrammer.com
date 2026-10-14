using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.Options;
using Microsoft.JSInterop;
using Portfolio.Blazor.Configurations;

namespace Portfolio.Blazor.Components;

/// <summary>Code-behind for the kiosk demo dialog: opens the native dialog and tears the iframe down on close.</summary>
public sealed partial class KioskDialog : IAsyncDisposable
{
    private ElementReference _dialog;
    private bool _open;
    private bool _showPending;
    private DotNetObjectReference<KioskDialog>? _self;
    private IJSObjectReference? _module;

    [Inject]
    private IJSRuntime Js { get; set; } = null!;

    [Inject]
    private IOptions<SiteOptions> Options { get; set; } = null!;

    /// <summary>Renders the iframe and shows the dialog modally.</summary>
    public Task OpenAsync()
    {
        if (_open)
        {
            return Task.CompletedTask;
        }

        _open = true;
        _showPending = true;
        StateHasChanged();
        return Task.CompletedTask;
    }

    /// <summary>Called from site.js when the dialog closes, whichever way (button, backdrop, Escape).</summary>
    [JSInvokable]
    public void OnClosed()
    {
        _open = false;
        StateHasChanged();
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        if (_module is not null)
        {
            await _module.DisposeAsync();
        }

        _self?.Dispose();
    }

    /// <inheritdoc />
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!_showPending)
        {
            return;
        }

        _showPending = false;
        _self ??= DotNetObjectReference.Create(this);
        _module ??= await Js.InvokeAsync<IJSObjectReference>("import", "./js/site.js");
        await _module.InvokeVoidAsync("showModal", _dialog, _self);
    }

    private async Task CloseAsync()
    {
        if (_module is not null)
        {
            await _module.InvokeVoidAsync("closeDialog", _dialog);
        }
    }
}
