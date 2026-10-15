using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Portfolio.Blazor.Pages;

/// <summary>Code-behind for the one page: starts the engagement beacon in site.js once the sections exist.</summary>
public sealed partial class Home : IAsyncDisposable
{
    private IJSObjectReference? _module;
    private IJSObjectReference? _engagementWatch;

    [Inject]
    private IJSRuntime Js { get; set; } = null!;

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        if (_engagementWatch is not null)
        {
            await _engagementWatch.InvokeVoidAsync("dispose");
            await _engagementWatch.DisposeAsync();
        }

        if (_module is not null)
        {
            await _module.DisposeAsync();
        }
    }

    /// <inheritdoc />
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!firstRender)
        {
            return;
        }

        _module = await Js.InvokeAsync<IJSObjectReference>("import", "./js/site.js");
        _engagementWatch = await _module.InvokeAsync<IJSObjectReference?>("watchEngagement");
    }
}
