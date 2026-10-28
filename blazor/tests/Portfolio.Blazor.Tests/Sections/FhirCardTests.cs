using Microsoft.AspNetCore.Components;
using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Sections;

/// <summary>Tests for the FHIR API card in <see cref="PortfolioSection"/>: the accordion, the deferred explorer, and the URL hash.</summary>
public sealed class FhirCardTests : BunitContext
{
    #region Render Tests

    /// <summary>The card is first after the featured card, closed, with its links and image, and the explorer is not rendered, so no FHIR request is made.</summary>
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
        var card = cards[1];
        Assert.Equal("fhir-api", card.Id);
        Assert.Equal("FHIR API", card.QuerySelector("h3")?.TextContent);
        Assert.Equal("assets/images/portfolio/fhir-api-blazor.jpg", card.QuerySelector(".card-media img")?.GetAttribute("src"));
        var links = card.QuerySelectorAll(":scope > .card-body > .card-links > .card-link").Select(a => a.GetAttribute("href")).ToList();
        Assert.Equal(
        [
            "https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/api/src/Fhir.Api",
            "https://github.com/mvcprogrammer/mvcprogrammer.com/blob/main/api/openapi.yaml",
        ], links);
        Assert.True(Accordion(cut).NextElementSibling?.ClassList.Contains("card-links"), "the link row follows the explorer button");
        Assert.False(Accordion(cut).HasAttribute("open"), "the accordion starts closed");
        Assert.Contains("button-primary", Accordion(cut).QuerySelector("summary")?.ClassName, StringComparison.Ordinal);
        Assert.Empty(cut.FindAll("#fhir-search"));
        Assert.Equal(0, fhir.CapabilityCalls);
        Assert.False(cut.Instance.FhirOpen, "state mirrors the closed accordion");
        Assert.Single(module.Invocations, i => i.Identifier == "watchDetails");
        Assert.Single(module.Invocations, i => i.Identifier == "watchHash" && Equals(i.Arguments[1], PortfolioSection.FHIR_HASH));
    }

    /// <summary>Each project card has one primary button and a single row of links after it.</summary>
    [Fact]
    public void Render_ShouldGiveEachProjectCardOneButtonAndOneLinkRowAfterIt()
    {
        // Arrange
        this.AddSiteOptions();
        this.AddFhirClient();
        this.SetupSiteModule();

        // Act
        var cut = Render<PortfolioSection>();

        // Assert
        var cards = cut.FindAll(".portfolio-card:not(.portfolio-card-featured)");
        var actions = cards.Select(card =>
        {
            var buttons = card.QuerySelectorAll(".card-actions .button-primary, .fhir-accordion > summary.button-primary");
            var rows = card.QuerySelectorAll(":scope > .card-body > .card-links");
            var rowAfterButton = buttons.Length > 0 && rows.Length > 0 && buttons[0].CompareDocumentPosition(rows[0]).HasFlag(AngleSharp.Dom.DocumentPositions.Following);
            var links = string.Join("|", rows.SelectMany(r => r.QuerySelectorAll(".card-link")).Select(a => a.TextContent.Trim()));
            return $"{buttons.Length} button, {rows.Length} row, after={rowAfterButton}: {links}";
        }).ToList();
        Assert.Equal(
        [
            "1 button, 1 row, after=True: API repo|OpenAPI spec",
            "1 button, 1 row, after=True: Site repo",
            "1 button, 1 row, after=True: Screen repo|API repo",
        ], actions);
        var visit = cards[1].QuerySelector(".card-actions a.button-primary");
        Assert.Equal("https://lightsplitters.com", visit?.GetAttribute("href"));
        Assert.Equal("Visit lightsplitters.com", visit?.TextContent.Trim());
        Assert.Equal("#icon-globe", visit?.QuerySelector("use")?.GetAttribute("href"));
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

    /// <summary>Opening scrolls the card to the top of the viewport through site.js; closing does not scroll.</summary>
    [Fact]
    public async Task OnToggled_ShouldScrollCardIntoViewOnOpenOnly()
    {
        // Arrange
        this.AddSiteOptions();
        this.AddFhirClient();
        var module = this.SetupSiteModule();
        var cut = Render<PortfolioSection>();
        Assert.DoesNotContain(module.Invocations, i => i.Identifier == "scrollIntoView");

        // Act
        await cut.InvokeAsync(() => cut.Instance.OnToggled(true));

        // Assert
        var scroll = Assert.Single(module.Invocations, i => i.Identifier == "scrollIntoView");
        Assert.IsType<ElementReference>(scroll.Arguments[0]);

        // Act again
        await cut.InvokeAsync(() => cut.Instance.OnToggled(false));

        // Assert again
        Assert.Single(module.Invocations, i => i.Identifier == "scrollIntoView");
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
