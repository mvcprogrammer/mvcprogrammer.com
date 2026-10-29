using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Portfolio.Blazor.Components;

/// <summary>Code-behind for a live demo dialog: opens the native dialog and tears the iframe down on close.</summary>
public sealed partial class DemoDialog : IAsyncDisposable
{
    private ElementReference _dialog;
    private bool _open;
    private bool _showPending;
    private DotNetObjectReference<DemoDialog>? _self;
    private IJSObjectReference? _module;

    /// <summary>The dialog element's id; the heading is "{Id}-title".</summary>
    [Parameter]
    [EditorRequired]
    public string Id { get; set; } = string.Empty;

    /// <summary>The heading.</summary>
    [Parameter]
    [EditorRequired]
    public string Title { get; set; } = string.Empty;

    /// <summary>The line under the heading saying what the visitor is looking at.</summary>
    [Parameter]
    [EditorRequired]
    public string Note { get; set; } = string.Empty;

    /// <summary>The absolute URL framed while the dialog is open and linked in the foot.</summary>
    [Parameter]
    [EditorRequired]
    public string Src { get; set; } = string.Empty;

    /// <summary>The iframe's accessible title.</summary>
    [Parameter]
    [EditorRequired]
    public string FrameTitle { get; set; } = string.Empty;

    /// <summary>True for a demo that needs a taller frame than the 16:9 default; the stylesheet keys on data-frame="tall".</summary>
    [Parameter]
    public bool Tall { get; set; }

    [Inject]
    private IJSRuntime Js { get; set; } = null!;

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
