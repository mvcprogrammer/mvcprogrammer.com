using Portfolio.Blazor.Components;

namespace Portfolio.Blazor.Tests.Components;

/// <summary>Tests for the small presentational components: icons, social links, and the footer.</summary>
public sealed class ChromeComponentTests : BunitContext
{
    #region Icon Tests

    /// <summary>An icon references its sprite symbol and is hidden from assistive technology.</summary>
    [Fact]
    public void Icon_ShouldReferenceSpriteSymbol()
    {
        // Arrange and Act
        var cut = Render<Icon>(p => p.Add(i => i.Name, "github"));

        // Assert
        Assert.Equal("#icon-github", cut.Find("use").GetAttribute("href"));
        Assert.Equal("true", cut.Find("svg").GetAttribute("aria-hidden"));
    }

    /// <summary>The sprite defines every symbol the components reference.</summary>
    [Theory]
    [InlineData("github")]
    [InlineData("linkedin")]
    [InlineData("flickr")]
    [InlineData("design")]
    [InlineData("data")]
    [InlineData("code")]
    [InlineData("test")]
    [InlineData("deploy")]
    [InlineData("monitor")]
    [InlineData("preview")]
    [InlineData("wrench")]
    [InlineData("audit")]
    [InlineData("savings")]
    [InlineData("mail")]
    [InlineData("download")]
    public void IconSprite_ShouldDefineSymbol(string name)
    {
        // Arrange and Act
        var cut = Render<IconSprite>();

        // Assert
        Assert.NotNull(cut.Find($"symbol#icon-{name}"));
    }

    #endregion

    #region SocialLinks Tests

    /// <summary>Three profiles, each opening in a new tab without a referrer.</summary>
    [Fact]
    public void SocialLinks_ShouldRenderThreeExternalProfiles()
    {
        // Arrange and Act
        var cut = Render<SocialLinks>();

        // Assert
        var links = cut.FindAll("a.social-link");
        Assert.Equal(3, links.Count);
        Assert.All(links, l => Assert.Equal("_blank", l.GetAttribute("target")));
        Assert.All(links, l => Assert.Contains("noopener", l.GetAttribute("rel"), StringComparison.Ordinal));
        Assert.Equal(["GitHub", "LinkedIn", "Flickr"], links.Select(l => l.GetAttribute("aria-label")));
    }

    #endregion

    #region SiteFooter Tests

    /// <summary>The footer shows the current year and sends the legal pages to the static edition.</summary>
    [Fact]
    public void SiteFooter_ShouldShowYearAndLegalLinks()
    {
        // Arrange and Act
        var cut = Render<SiteFooter>();

        // Assert
        Assert.Contains(DateTime.UtcNow.Year.ToString(System.Globalization.CultureInfo.InvariantCulture), cut.Find(".footer-copy").TextContent, StringComparison.Ordinal);
        Assert.Equal(["https://mvcprogrammer.com/privacy.html", "https://mvcprogrammer.com/terms.html"], cut.FindAll(".footer-links a").Select(a => a.GetAttribute("href")));
        Assert.Equal(3, cut.FindAll(".social-link").Count);
    }

    #endregion
}
