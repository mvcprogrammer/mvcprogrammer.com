using Portfolio.Blazor.Pages;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Pages;

/// <summary>Tests for <see cref="Home"/>: the section order and the engagement beacon.</summary>
public sealed class HomeTests : BunitContext
{
    #region Render Tests

    /// <summary>The page renders every section in the nav order and starts the engagement beacon through the JS module.</summary>
    [Fact]
    public void Render_ShouldRenderSectionsInOrderAndStartEngagementWatch()
    {
        // Arrange
        this.AddSiteServices();
        var module = this.SetupSiteModule();

        // Act
        var cut = Render<Home>();

        // Assert
        var ids = cut.FindAll("section[id]").Select(section => section.Id).ToArray();
        Assert.Equal(["about", "services", "freelance", "portfolio", "resume", "contact", "colophon"], ids);
        Assert.Single(module.Invocations, i => i.Identifier == "watchEngagement");
    }

    /// <summary>Disposing the page disposes the watch handle the beacon returned, then the module.</summary>
    [Fact]
    public async Task DisposeAsync_ShouldDisposeWatchHandle()
    {
        // Arrange
        this.AddSiteServices();
        var module = this.SetupSiteModule();
        var cut = Render<Home>();

        // Act
        await cut.Instance.DisposeAsync();

        // Assert
        Assert.Equal(["watchEngagement", "dispose"], module.Invocations.Select(i => i.Identifier).ToArray());
    }

    #endregion
}
