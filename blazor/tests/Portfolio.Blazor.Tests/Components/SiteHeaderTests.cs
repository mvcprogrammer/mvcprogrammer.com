using Portfolio.Blazor.Components;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Components;

/// <summary>Tests for <see cref="SiteHeader"/>: the mobile menu, the edition list, scroll state, and current-section highlight.</summary>
public sealed class SiteHeaderTests : BunitContext
{
    #region Render Tests

    /// <summary>On first render the header wires the scroll and section watchers through the JS module.</summary>
    [Fact]
    public void Render_ShouldStartScrollAndSectionWatchers()
    {
        // Arrange
        var module = this.SetupSiteModule();

        // Act
        var cut = Render<SiteHeader>();

        // Assert
        Assert.Single(module.Invocations, i => i.Identifier == "watchHeader");
        var observe = Assert.Single(module.Invocations, i => i.Identifier == "observeSections");
        Assert.Equal(["about", "services", "portfolio", "resume", "contact"], Assert.IsType<string[]>(observe.Arguments[1]));
        Assert.Equal(5, cut.FindAll(".nav-link").Count);
        Assert.Equal("false", cut.Find(".nav-toggle").GetAttribute("aria-expanded"));
        Assert.Equal("Blazor Edition", cut.Find(".edition-toggle").TextContent.Trim());
        Assert.Equal("false", cut.Find(".edition-toggle").GetAttribute("aria-expanded"));
        Assert.Equal(["JS Edition", "Angular Edition", "React Edition", "Blazor Edition"], cut.FindAll(".edition-link").Select(a => a.TextContent.Trim()));
        var current = Assert.Single(cut.FindAll(".edition-link[aria-current='true']"));
        Assert.Equal("https://blazor.mvcprogrammer.com/", current.GetAttribute("href"));
        Assert.DoesNotContain("is-scrolled", cut.Find("header").ClassList);
        Assert.DoesNotContain(module.Invocations, i => i.Identifier == "watchMenu");
    }

    #endregion

    #region ToggleMenu Tests

    /// <summary>The toggle opens the menu, updates its ARIA state, and starts the document watcher.</summary>
    [Fact]
    public void ToggleMenu_ShouldOpenMenuAndWatchDocument()
    {
        // Arrange
        var module = this.SetupSiteModule();
        var cut = Render<SiteHeader>();

        // Act
        cut.Find(".nav-toggle").Click();

        // Assert
        Assert.Contains("is-open", cut.Find("nav").ClassList);
        Assert.Equal("true", cut.Find(".nav-toggle").GetAttribute("aria-expanded"));
        Assert.Equal("Close menu", cut.Find(".nav-toggle").GetAttribute("aria-label"));
        Assert.Single(module.Invocations, i => i.Identifier == "watchMenu");
    }

    /// <summary>A second press closes the menu.</summary>
    [Fact]
    public void ToggleMenu_ShouldCloseMenuOnSecondPress()
    {
        // Arrange
        this.SetupSiteModule();
        var cut = Render<SiteHeader>();
        cut.Find(".nav-toggle").Click();

        // Act
        cut.Find(".nav-toggle").Click();

        // Assert
        Assert.DoesNotContain("is-open", cut.Find("nav").ClassList);
        Assert.Equal("Open menu", cut.Find(".nav-toggle").GetAttribute("aria-label"));
    }

    #endregion

    #region CloseMenu Tests

    /// <summary>Choosing a section closes the menu so the page is visible when it scrolls.</summary>
    [Fact]
    public void CloseMenu_ShouldCloseWhenNavLinkClicked()
    {
        // Arrange
        this.SetupSiteModule();
        var cut = Render<SiteHeader>();
        cut.Find(".nav-toggle").Click();

        // Act
        cut.Find(".nav-link").Click();

        // Assert
        Assert.DoesNotContain("is-open", cut.Find("nav").ClassList);
    }

    /// <summary>Escape (reported by site.js with returnFocus) closes the menu and focuses the toggle.</summary>
    [Fact]
    public async Task CloseMenu_ShouldReturnFocusToToggleWhenAsked()
    {
        // Arrange
        var module = this.SetupSiteModule();
        var cut = Render<SiteHeader>();
        cut.Find(".nav-toggle").Click();

        // Act
        await cut.InvokeAsync(() => cut.Instance.CloseMenu(true));

        // Assert
        Assert.DoesNotContain("is-open", cut.Find("nav").ClassList);
        Assert.Single(module.Invocations, i => i.Identifier == "focus");
    }

    /// <summary>Closing an already closed menu is a no-op and does not touch focus.</summary>
    [Fact]
    public async Task CloseMenu_ShouldDoNothingWhenAlreadyClosed()
    {
        // Arrange
        var module = this.SetupSiteModule();
        var cut = Render<SiteHeader>();

        // Act
        await cut.InvokeAsync(() => cut.Instance.CloseMenu(true));

        // Assert
        Assert.DoesNotContain(module.Invocations, i => i.Identifier == "focus");
    }

    #endregion

    #region ToggleEditions Tests

    /// <summary>The edition button opens the list, updates its ARIA state, and starts a document watcher that reports through CloseEditions.</summary>
    [Fact]
    public void ToggleEditions_ShouldOpenListAndWatchDocument()
    {
        // Arrange
        var module = this.SetupSiteModule();
        var cut = Render<SiteHeader>();

        // Act
        cut.Find(".edition-toggle").Click();

        // Assert
        Assert.Contains("is-open", cut.Find(".edition").ClassList);
        Assert.Equal("true", cut.Find(".edition-toggle").GetAttribute("aria-expanded"));
        var watch = Assert.Single(module.Invocations, i => i.Identifier == "watchMenu");
        Assert.Equal("CloseEditions", watch.Arguments[2]);
    }

    /// <summary>A second press closes the list and releases the watcher.</summary>
    [Fact]
    public void ToggleEditions_ShouldCloseListOnSecondPress()
    {
        // Arrange
        this.SetupSiteModule();
        var cut = Render<SiteHeader>();
        cut.Find(".edition-toggle").Click();

        // Act
        cut.Find(".edition-toggle").Click();

        // Assert
        Assert.DoesNotContain("is-open", cut.Find(".edition").ClassList);
        Assert.Equal("false", cut.Find(".edition-toggle").GetAttribute("aria-expanded"));
    }

    #endregion

    #region CloseEditions Tests

    /// <summary>Escape (reported by site.js with returnFocus) closes the list and focuses the edition button.</summary>
    [Fact]
    public async Task CloseEditions_ShouldReturnFocusToButtonWhenAsked()
    {
        // Arrange
        var module = this.SetupSiteModule();
        var cut = Render<SiteHeader>();
        cut.Find(".edition-toggle").Click();

        // Act
        await cut.InvokeAsync(() => cut.Instance.CloseEditions(true));

        // Assert
        Assert.DoesNotContain("is-open", cut.Find(".edition").ClassList);
        Assert.Single(module.Invocations, i => i.Identifier == "focus");
    }

    /// <summary>Closing an already closed list is a no-op and does not touch focus.</summary>
    [Fact]
    public async Task CloseEditions_ShouldDoNothingWhenAlreadyClosed()
    {
        // Arrange
        var module = this.SetupSiteModule();
        var cut = Render<SiteHeader>();

        // Act
        await cut.InvokeAsync(() => cut.Instance.CloseEditions(true));

        // Assert
        Assert.DoesNotContain(module.Invocations, i => i.Identifier == "focus");
    }

    #endregion

    #region SetScrolled Tests

    /// <summary>Scrolling past the threshold adds the shadow class; scrolling back removes it.</summary>
    [Fact]
    public async Task SetScrolled_ShouldToggleScrolledClass()
    {
        // Arrange
        this.SetupSiteModule();
        var cut = Render<SiteHeader>();

        // Act
        await cut.InvokeAsync(() => cut.Instance.SetScrolled(true));
        var scrolled = cut.Find("header").ClassList.Contains("is-scrolled");
        await cut.InvokeAsync(() => cut.Instance.SetScrolled(false));

        // Assert
        Assert.True(scrolled, "the header gains is-scrolled");
        Assert.DoesNotContain("is-scrolled", cut.Find("header").ClassList);
    }

    #endregion

    #region SetCurrentSection Tests

    /// <summary>Only the link for the section in view carries aria-current.</summary>
    [Fact]
    public async Task SetCurrentSection_ShouldMarkOnlyCurrentLink()
    {
        // Arrange
        this.SetupSiteModule();
        var cut = Render<SiteHeader>();

        // Act
        await cut.InvokeAsync(() => cut.Instance.SetCurrentSection("portfolio"));

        // Assert
        var current = Assert.Single(cut.FindAll(".nav-link[aria-current]"));
        Assert.Equal("#portfolio", current.GetAttribute("href"));
        Assert.Equal("true", current.GetAttribute("aria-current"));
    }

    /// <summary>Near the top of the page no link is current.</summary>
    [Fact]
    public async Task SetCurrentSection_ShouldClearWhenNull()
    {
        // Arrange
        this.SetupSiteModule();
        var cut = Render<SiteHeader>();
        await cut.InvokeAsync(() => cut.Instance.SetCurrentSection("about"));

        // Act
        await cut.InvokeAsync(() => cut.Instance.SetCurrentSection(null));

        // Assert
        Assert.Empty(cut.FindAll(".nav-link[aria-current]"));
    }

    #endregion

    #region DisposeAsync Tests

    /// <summary>Disposal releases the JS module without throwing, even when the watchers returned no handles.</summary>
    [Fact]
    public async Task DisposeAsync_ShouldReleaseModule()
    {
        // Arrange
        this.SetupSiteModule();
        Render<SiteHeader>();

        // Act
        var exception = await Record.ExceptionAsync(() => DisposeComponentsAsync());

        // Assert
        Assert.Null(exception);
    }

    #endregion
}
