using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Sections;

/// <summary>Tests for the FHIR API card in <see cref="PortfolioSection"/>: the accordion, the deferred explorer, and the URL hash.</summary>
public sealed class FhirCardTests : BunitContext
{
    #region Render Tests

    /// <summary>The card is last, closed, with its links and image, and the explorer is not rendered, so no FHIR request is made.</summary>
    [Fact]
    public void Render_ShouldShowClosedCardWithoutExplorer()
    {
        // Arrange
        this.AddSiteOptions();
        var fhir = this.AddFhirClient();
        var module = this.SetupSiteModule();

        // Act
        var cut = Render<PortfolioSection>();

        // Assert
        var cards = cut.FindAll(".portfolio-card");
        var card = cards[^1];
        Assert.Equal("fhir-api", card.Id);
        Assert.Equal("FHIR API", card.QuerySelector("h3")?.TextContent);
        Assert.Equal("assets/images/portfolio/fhir-api-blazor.jpg", card.QuerySelector(".card-media img")?.GetAttribute("src"));
        var links = card.QuerySelectorAll(":scope > .card-body > .card-link").Select(a => a.GetAttribute("href")).ToList();
        Assert.Equal(
        [
            "https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/api/src/Fhir.Api",
            "https://github.com/mvcprogrammer/mvcprogrammer.com/blob/main/api/openapi.yaml",
        ], links);
        Assert.False(Accordion(cut).HasAttribute("open"), "the accordion starts closed");
        Assert.Contains("button-primary", Accordion(cut).QuerySelector("summary")?.ClassName, StringComparison.Ordinal);
        Assert.Empty(cut.FindAll("#fhir-search"));
        Assert.Equal(0, fhir.CapabilityCalls);
        Assert.False(cut.Instance.FhirOpen, "state mirrors the closed accordion");
        Assert.Single(module.Invocations, i => i.Identifier == "watchDetails");
        Assert.Single(module.Invocations, i => i.Identifier == "watchHash" && Equals(i.Arguments[1], PortfolioSection.FHIR_HASH));
    }

    #endregion

    #region OnToggled Tests

    /// <summary>Opening renders the explorer, which checks the capability; closing keeps it, and nothing is requested again.</summary>
    [Fact]
    public async Task OnToggled_ShouldRenderExplorerOnOpenAndKeepItOnClose()
    {
        // Arrange
        this.AddSiteOptions();
        var fhir = this.AddFhirClient();
        this.SetupSiteModule();
        var cut = Render<PortfolioSection>();

        // Act
        await cut.InvokeAsync(() => cut.Instance.OnToggled(true));

        // Assert
        Assert.True(Accordion(cut).HasAttribute("open"), "state opened the accordion");
        Assert.NotNull(cut.Find("#fhir-search"));
        await cut.WaitForAssertionAsync(() => Assert.Equal(1, fhir.CapabilityCalls));

        // Act again
        await cut.InvokeAsync(() => cut.Instance.OnToggled(false));

        // Assert again
        Assert.False(Accordion(cut).HasAttribute("open"), "state closed the accordion");
        Assert.NotNull(cut.Find("#fhir-search"));
        Assert.Equal(1, fhir.CapabilityCalls);
    }

    #endregion

    #region OnHashMatched Tests

    /// <summary>The URL hash opens the accordion and renders the explorer.</summary>
    [Fact]
    public async Task OnHashMatched_ShouldOpenAccordionAndRenderExplorer()
    {
        // Arrange
        this.AddSiteOptions();
        var fhir = this.AddFhirClient();
        this.SetupSiteModule();
        var cut = Render<PortfolioSection>();

        // Act
        await cut.InvokeAsync(() => cut.Instance.OnHashMatched());

        // Assert
        Assert.True(cut.Instance.FhirOpen, "the hash opened the card");
        Assert.True(Accordion(cut).HasAttribute("open"), "the accordion follows the state");
        await cut.WaitForAssertionAsync(() => Assert.Equal(1, fhir.CapabilityCalls));
    }

    #endregion

    #region Helper Methods

    private static AngleSharp.Dom.IElement Accordion(IRenderedComponent<PortfolioSection> cut) => cut.Find("details.fhir-accordion");

    #endregion
}
