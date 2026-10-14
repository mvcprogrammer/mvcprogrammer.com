using Portfolio.Blazor.Components;
using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Components;

/// <summary>Tests for <see cref="KioskDialog"/> and the portfolio card that opens it.</summary>
public sealed class KioskDialogTests : BunitContext
{
    #region Render Tests

    /// <summary>Closed, the dialog has no iframe, so the kiosk does not load until asked.</summary>
    [Fact]
    public void Render_ShouldNotRenderIframeWhileClosed()
    {
        // Arrange
        this.AddSiteOptions();
        this.SetupSiteModule();

        // Act
        var cut = Render<KioskDialog>();

        // Assert
        Assert.Empty(cut.FindAll("iframe"));
        Assert.Equal("https://kiosk.example.test/", cut.Find(".kiosk-dialog-foot a").GetAttribute("href"));
    }

    #endregion

    #region OpenAsync Tests

    /// <summary>Opening renders the iframe at the configured URL and shows the native dialog.</summary>
    [Fact]
    public async Task OpenAsync_ShouldRenderIframeAndShowModal()
    {
        // Arrange
        this.AddSiteOptions();
        var module = this.SetupSiteModule();
        var cut = Render<KioskDialog>();

        // Act
        await cut.InvokeAsync(() => cut.Instance.OpenAsync());

        // Assert
        Assert.Equal("https://kiosk.example.test/", cut.Find("iframe").GetAttribute("src"));
        await cut.WaitForAssertionAsync(() => Assert.Single(module.Invocations, i => i.Identifier == "showModal"));
    }

    /// <summary>Opening twice shows the dialog once.</summary>
    [Fact]
    public async Task OpenAsync_ShouldBeIdempotent()
    {
        // Arrange
        this.AddSiteOptions();
        var module = this.SetupSiteModule();
        var cut = Render<KioskDialog>();
        await cut.InvokeAsync(() => cut.Instance.OpenAsync());

        // Act
        await cut.InvokeAsync(() => cut.Instance.OpenAsync());

        // Assert
        Assert.Single(cut.FindAll("iframe"));
        Assert.Single(module.Invocations, i => i.Identifier == "showModal");
    }

    #endregion

    #region OnClosed Tests

    /// <summary>When the dialog closes, the iframe is removed so the kiosk stops running.</summary>
    [Fact]
    public async Task OnClosed_ShouldRemoveIframe()
    {
        // Arrange
        this.AddSiteOptions();
        this.SetupSiteModule();
        var cut = Render<KioskDialog>();
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
        this.AddSiteOptions();
        var module = this.SetupSiteModule();
        var cut = Render<KioskDialog>();
        await cut.InvokeAsync(() => cut.Instance.OpenAsync());

        // Act
        cut.Find(".kiosk-dialog-close").Click();

        // Assert
        Assert.Single(module.Invocations, i => i.Identifier == "closeDialog");
    }

    /// <summary>Before the module has loaded (dialog never opened), the close button is harmless.</summary>
    [Fact]
    public void CloseButton_ShouldDoNothingBeforeOpen()
    {
        // Arrange
        this.AddSiteOptions();
        var module = this.SetupSiteModule();
        var cut = Render<KioskDialog>();

        // Act
        cut.Find(".kiosk-dialog-close").Click();

        // Assert
        Assert.Empty(module.Invocations);
    }

    #endregion

    #region PortfolioSection Tests

    /// <summary>The "Try the live kiosk" button on the portfolio card opens the dialog.</summary>
    [Fact]
    public async Task PortfolioSection_ShouldOpenKioskFromCardButton()
    {
        // Arrange
        this.AddSiteOptions();
        this.SetupSiteModule();
        var cut = Render<PortfolioSection>();
        Assert.Empty(cut.FindAll("iframe"));

        // Act
        await cut.Find("button.button-primary").ClickAsync(new Microsoft.AspNetCore.Components.Web.MouseEventArgs());

        // Assert
        Assert.Equal("https://kiosk.example.test/", cut.Find("iframe").GetAttribute("src"));
        Assert.Equal(3, cut.FindAll(".portfolio-card").Count);
    }

    #endregion
}
