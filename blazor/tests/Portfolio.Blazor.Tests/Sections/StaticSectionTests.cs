using Portfolio.Blazor.Pages;
using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Sections;

/// <summary>Markup checks for the sections that carry content only, plus the home page that composes them.</summary>
public sealed class StaticSectionTests : BunitContext
{
    #region AboutSection Tests

    /// <summary>The Angular, React, Blazor, and JavaScript tags lead to the four editions with a hint; the list is the same on every edition.</summary>
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
        ], links);
        Assert.Equal(12, cut.FindAll("ul[aria-label=Skills] .tag").Count);
        Assert.Contains(cut.FindAll(".tag"), t => t.TextContent == "Claude Pair Programming");
        Assert.DoesNotContain(cut.FindAll(".tag"), t => t.TextContent == "RabbitMQ");
    }

    #endregion

    #region HeroSection Tests

    /// <summary>The C# / .NET, Angular, and React highlights link to the matching editions with a hint; the database one stays plain.</summary>
    [Fact]
    public void HeroSection_ShouldLinkHighlightsToEditions()
    {
        // Arrange and Act
        var cut = Render<HeroSection>();

        // Assert
        var links = cut.FindAll(".highlight-value a").Select(a => (a.TextContent, a.GetAttribute("href"), a.GetAttribute("title"))).ToList();
        Assert.Equal(
        [
            ("C# / .NET", "https://blazor.mvcprogrammer.com/", "See the C# / .NET edition of this site"),
            ("Angular", "https://angular.mvcprogrammer.com/", "See the Angular edition of this site"),
            ("React", "https://react.mvcprogrammer.com/", "See the React edition of this site"),
        ], links);
        Assert.Equal(3, cut.FindAll(".highlights li").Count);
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
