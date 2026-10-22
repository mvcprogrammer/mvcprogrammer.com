using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Sections;

/// <summary>The employer section preselects the contact topic through the shared state.</summary>
public sealed class CallToActionTests : BunitContext
{
    #region ServicesSection Tests

    /// <summary>"Talk about a role" selects the job topic before the page scrolls to the form.</summary>
    [Fact]
    public void ServicesSection_ShouldSelectJobTopicOnCallToAction()
    {
        // Arrange
        var (_, _, topic) = this.AddSiteServices();
        string? selected = null;
        topic.Subscribe(t => selected = t);
        var cut = Render<ServicesSection>();

        // Act
        cut.Find("a.button-primary[href='#contact']").Click();

        // Assert
        Assert.Equal("Job opportunity", selected);
        Assert.Equal(6, cut.FindAll(".service-card").Count);
    }

    #endregion
}
