using Portfolio.Blazor.Pages;
using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Sections;

/// <summary>Markup checks for the sections that carry content only, plus the home page that composes them.</summary>
public sealed class StaticSectionTests : BunitContext
{
    #region AboutSection Tests

    /// <summary>The Angular, React, Blazor, and JavaScript tags lead to the four editions and the Healthcare tag to the FHIR API card, each with a hint; the list is the same on every edition.</summary>
    [Fact]
    public void AboutSection_ShouldLinkEditionTagsWithHints()
    {
        // Arrange and Act
        var cut = Render<AboutSection>();

        // Assert
        var links = cut.FindAll(".tag a").Select(a => (a.TextContent, a.GetAttribute("href"), a.GetAttribute("title"))).ToList();
        Assert.Equal(
        [
            ("Angular", "https://angular.mvcprogrammer.com/", "See the Angular edition of this site"),
            ("React", "https://react.mvcprogrammer.com/", "See the React edition of this site"),
            ("Blazor", "https://blazor.mvcprogrammer.com/", "See the Blazor edition of this site"),
            ("JavaScript", "https://mvcprogrammer.com/", "See the plain JavaScript edition of this site"),
            ("Healthcare (HL7, FHIR, HIPAA)", "#fhir-api", "Open the FHIR API card and its live patient explorer in Selected Work"),
        ], links);
        Assert.Equal(12, cut.FindAll("ul[aria-label=Skills] .tag").Count);
        Assert.Contains(cut.FindAll(".tag"), t => t.TextContent == "Claude Pair Programming");
        Assert.DoesNotContain(cut.FindAll(".tag"), t => t.TextContent == "RabbitMQ");
    }

    #endregion

    #region HeroSection Tests

    /// <summary>The three highlights are plain text: no highlight links to the editions (removed 2026-10-19), the edition menu and the About chips carry those.</summary>
    [Fact]
    public void HeroSection_ShouldRenderPlainHighlights()
    {
        // Arrange and Act
        var cut = Render<HeroSection>();

        // Assert
        Assert.Empty(cut.FindAll(".highlight-value a"));
        Assert.Equal(3, cut.FindAll(".highlights li").Count);
        Assert.Equal("C# / .NET", cut.FindAll(".highlight-value")[0].TextContent);
        Assert.Equal("Angular / React", cut.FindAll(".highlight-value")[1].TextContent);
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
