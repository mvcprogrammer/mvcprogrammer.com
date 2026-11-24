using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Sections;

/// <summary>The offerings section preselects the contact topic through the shared state.</summary>
public sealed class CallToActionTests : BunitContext
{
    #region ServicesSection Tests

    /// <summary>"Talk about a role" selects the job topic before the page scrolls to the form.</summary>
    [Fact]
    public void ServicesSection_ShouldSelectJobTopicOnCallToAction()
    {
        // Arrange
        var (_, topic) = this.AddSiteServices();
        string? selected = null;
        topic.Subscribe(t => selected = t);
        var cut = Render<ServicesSection>();

        // Act
        cut.Find("a.button-primary[href='#contact']").Click();

        // Assert
        Assert.Equal("Job opportunity", selected);
        Assert.Equal(6, cut.FindAll(".service-card").Count);
    }

    /// <summary>"Talk about a contract" selects the contract topic before the page scrolls to the form.</summary>
    [Fact]
    public void ServicesSection_ShouldSelectContractTopicOnCallToAction()
    {
        // Arrange
        var (_, topic) = this.AddSiteServices();
        string? selected = null;
        topic.Subscribe(t => selected = t);
        var cut = Render<ServicesSection>();
        var links = cut.FindAll("a.button-primary[href='#contact']");

        // Act
        links[1].Click();

        // Assert
        Assert.Equal(2, links.Count);
        Assert.Equal("Talk about a contract", links[1].TextContent);
        Assert.Equal("Contract or consulting", selected);
    }

    #endregion
}
