using Portfolio.Blazor.Pages;
using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Sections;

/// <summary>Markup checks for the sections that carry content only, plus the home page that composes them.</summary>
public sealed class StaticSectionTests : BunitContext
{
    #region AboutSection Tests

    /// <summary>The linked core-skill tags are this edition's side of the mirror rule: "Angular" and "JavaScript" point at the other two editions, and there is no "Blazor" tag.</summary>
    [Fact]
    public void AboutSection_ShouldLinkAngularAndJavaScriptTagsToOtherEditions()
    {
        // Arrange and Act
        var cut = Render<AboutSection>();

        // Assert
        var links = cut.FindAll(".tag a").Select(a => (a.TextContent, a.GetAttribute("href"))).ToList();
        Assert.Equal([("Angular", "https://angular.mvcprogrammer.com/"), ("JavaScript", "https://mvcprogrammer.com/")], links);
        Assert.DoesNotContain(cut.FindAll(".tag"), t => t.TextContent == "Blazor");
        Assert.DoesNotContain(cut.FindAll(".tag"), t => t.TextContent == "RabbitMQ");
    }

    #endregion

    #region ResumeSection Tests

    /// <summary>The resume button points at the configured download URL.</summary>
    [Fact]
    public void ResumeSection_ShouldUseConfiguredResumeUrl()
    {
        // Arrange
        this.AddSiteServices();

        // Act
        var cut = Render<ResumeSection>();

        // Assert
        Assert.Equal("https://resume.example.test/", cut.Find("a.button-secondary").GetAttribute("href"));
        Assert.NotNull(cut.Find("#experience-timeline"));
        Assert.Equal(2, cut.FindAll(".timeline-compact .timeline-item").Count);
    }

    #endregion

    #region ColophonSection Tests

    /// <summary>The colophon links to the Blazor source and describes this edition.</summary>
    [Fact]
    public void ColophonSection_ShouldLinkToBlazorSource()
    {
        // Arrange and Act
        var cut = Render<ColophonSection>();

        // Assert
        Assert.Equal("https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/blazor", cut.Find("a.card-link").GetAttribute("href"));
        Assert.Contains("Blazor WebAssembly", cut.Find(".section-intro").TextContent, StringComparison.Ordinal);
    }

    #endregion

    #region Home Tests

    /// <summary>The home page composes every section in the nav's order.</summary>
    [Fact]
    public void Home_ShouldRenderEverySectionInOrder()
    {
        // Arrange
        this.AddSiteServices();
        this.SetupSiteModule();

        // Act
        var cut = Render<Home>();

        // Assert
        var ids = cut.FindAll("section[id]").Select(s => s.Id).ToList();
        Assert.Equal(["about", "services", "freelance", "portfolio", "resume", "contact", "colophon"], ids);
        Assert.NotNull(cut.Find(".hero"));
        Assert.NotNull(cut.Find("#kiosk-dialog"));
    }

    #endregion
}
