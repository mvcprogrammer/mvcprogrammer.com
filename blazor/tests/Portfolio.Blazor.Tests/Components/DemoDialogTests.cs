using Microsoft.AspNetCore.Components;
using Portfolio.Blazor.Components;
using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Components;

/// <summary>Tests for <see cref="DemoDialog"/> and the portfolio cards that open its two instances.</summary>
public sealed class DemoDialogTests : BunitContext
{
    #region Render Tests

    /// <summary>Closed, the dialog has no iframe, so the demo does not load until asked, and its ids, heading, and foot link come from the parameters.</summary>
    [Fact]
    public void Render_ShouldNotRenderIframeWhileClosed()
    {
        // Arrange
        this.SetupSiteModule();

        // Act
        var cut = RenderKioskDialog();

        // Assert
        Assert.Empty(cut.FindAll("iframe"));
        var dialog = cut.Find("dialog.demo-dialog");
        Assert.Equal("kiosk-dialog", dialog.Id);
        Assert.Equal("kiosk-dialog-title", dialog.GetAttribute("aria-labelledby"));
        Assert.Equal("Interactive Property Search Window Display", cut.Find("#kiosk-dialog-title").TextContent);
        Assert.Equal("The real kiosk, scaled to fit.", cut.Find(".demo-dialog-note").TextContent);
        Assert.Equal("https://kiosk.example.test/", cut.Find(".demo-dialog-foot a").GetAttribute("href"));
        Assert.False(dialog.HasAttribute("data-frame"), "the kiosk keeps the default frame height");
    }

    /// <summary>A tall demo marks the dialog so the stylesheet gives the frame more height.</summary>
    [Fact]
    public void Render_ShouldMarkTallDialog()
    {
        // Arrange
        this.SetupSiteModule();

        // Act
        var cut = RenderExplorerDialog();

        // Assert
        var dialog = cut.Find("dialog.demo-dialog");
        Assert.Equal("fhir-dialog", dialog.Id);
        Assert.Equal("tall", dialog.GetAttribute("data-frame"));
        Assert.Equal("FHIR R4 Patient Explorer", cut.Find("#fhir-dialog-title").TextContent);
        Assert.Equal("https://fhir.example.test/", cut.Find(".demo-dialog-foot a").GetAttribute("href"));
    }

    #endregion

    #region OpenAsync Tests

    /// <summary>Opening renders the iframe at the configured URL with its title and shows the native dialog.</summary>
    [Fact]
    public async Task OpenAsync_ShouldRenderIframeAndShowModal()
    {
        // Arrange
        var module = this.SetupSiteModule();
        var cut = RenderKioskDialog();

        // Act
        await cut.InvokeAsync(() => cut.Instance.OpenAsync());

        // Assert
        var frame = cut.Find("iframe.demo-frame");
        Assert.Equal("https://kiosk.example.test/", frame.GetAttribute("src"));
        Assert.Equal("Interactive Property Search Window Display, live", frame.GetAttribute("title"));
        await cut.WaitForAssertionAsync(() => Assert.Single(module.Invocations, i => i.Identifier == "showModal"));
    }

    /// <summary>Opening twice shows the dialog once.</summary>
    [Fact]
    public async Task OpenAsync_ShouldBeIdempotent()
    {
        // Arrange
        var module = this.SetupSiteModule();
        var cut = RenderKioskDialog();
        await cut.InvokeAsync(() => cut.Instance.OpenAsync());

        // Act
        await cut.InvokeAsync(() => cut.Instance.OpenAsync());

        // Assert
        Assert.Single(cut.FindAll("iframe"));
        Assert.Single(module.Invocations, i => i.Identifier == "showModal");
    }

    #endregion

    #region OnClosed Tests

    /// <summary>When the dialog closes, the iframe is removed so the demo stops running.</summary>
    [Fact]
    public async Task OnClosed_ShouldRemoveIframe()
    {
        // Arrange
        this.SetupSiteModule();
        var cut = RenderKioskDialog();
        await cut.InvokeAsync(() => cut.Instance.OpenAsync());

        // Act
        await cut.InvokeAsync(() => cut.Instance.OnClosed());

        // Assert
        Assert.Empty(cut.FindAll("iframe"));
    }

    #endregion

    #region Close Button Tests

    /// <summary>The close button asks the browser to close the dialog; the close event then clears the iframe.</summary>
    [Fact]
    public async Task CloseButton_ShouldInvokeCloseDialog()
    {
        // Arrange
        var module = this.SetupSiteModule();
        var cut = RenderKioskDialog();
        await cut.InvokeAsync(() => cut.Instance.OpenAsync());

        // Act
        cut.Find(".demo-dialog-close").Click();

        // Assert
        Assert.Single(module.Invocations, i => i.Identifier == "closeDialog");
    }

    /// <summary>Before the module has loaded (dialog never opened), the close button is harmless.</summary>
    [Fact]
    public void CloseButton_ShouldDoNothingBeforeOpen()
    {
        // Arrange
        var module = this.SetupSiteModule();
        var cut = RenderKioskDialog();

        // Act
        cut.Find(".demo-dialog-close").Click();

        // Assert
        Assert.Empty(module.Invocations);
    }

    #endregion

    #region PortfolioSection Tests

    /// <summary>The "Try the live kiosk" button on the kiosk card opens the kiosk dialog and nothing else.</summary>
    [Fact]
    public async Task PortfolioSection_ShouldOpenKioskFromCardButton()
    {
        // Arrange
        this.AddSiteOptions();
        this.SetupSiteModule();
        var cut = Render<PortfolioSection>();
        Assert.Empty(cut.FindAll("iframe"));

        // Act
        await cut.Find(".portfolio-card:last-child .card-actions button.button-primary").ClickAsync(new Microsoft.AspNetCore.Components.Web.MouseEventArgs());

        // Assert
        var frame = Assert.Single(cut.FindAll("iframe"));
        Assert.Equal("https://kiosk.example.test/", frame.GetAttribute("src"));
        Assert.Equal(4, cut.FindAll(".portfolio-card").Count);
    }

    #endregion

    #region Helper Methods

    private IRenderedComponent<DemoDialog> RenderKioskDialog() =>
        Render<DemoDialog>(parameters => parameters
            .Add(d => d.Id, "kiosk-dialog")
            .Add(d => d.Title, "Interactive Property Search Window Display")
            .Add(d => d.Note, "The real kiosk, scaled to fit.")
            .Add(d => d.Src, "https://kiosk.example.test/")
            .Add(d => d.FrameTitle, "Interactive Property Search Window Display, live"));

    private IRenderedComponent<DemoDialog> RenderExplorerDialog() =>
        Render<DemoDialog>(parameters => parameters
            .Add(d => d.Id, "fhir-dialog")
            .Add(d => d.Title, "FHIR R4 Patient Explorer")
            .Add(d => d.Note, "The explorer, in front of the API.")
            .Add(d => d.Src, "https://fhir.example.test/")
            .Add(d => d.FrameTitle, "FHIR R4 Patient Explorer, live")
            .Add(d => d.Tall, true));

    #endregion
}
