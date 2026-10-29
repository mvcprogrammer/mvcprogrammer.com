using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Sections;

/// <summary>Tests for the FHIR API card in <see cref="PortfolioSection"/>: the pitch and the button that opens the explorer's dialog.</summary>
public sealed class FhirCardTests : BunitContext
{
    #region Render Tests

    /// <summary>The card is first after the featured card with its heading, subtitle, image, button, and links, and nothing FHIR-related is requested.</summary>
    [Fact]
    public void Render_ShouldShowPitchWithoutExplorer()
    {
        // Arrange
        this.AddSiteOptions();
        var module = this.SetupSiteModule();

        // Act
        var cut = Render<PortfolioSection>();

        // Assert
        var card = cut.FindAll(".portfolio-card")[1];
        Assert.Equal("fhir-api", card.Id);
        Assert.Equal("FHIR API", card.QuerySelector("h3")?.TextContent);
        Assert.Equal("FHIR R4 patient explorer, Angular in front of C# on Lambda with the Firely SDK", card.QuerySelector(".card-subtitle")?.TextContent);
        Assert.Equal("assets/images/portfolio/fhir-explorer.jpg", card.QuerySelector(".card-media img")?.GetAttribute("src"));
        Assert.Contains("fhir.mvcprogrammer.com", card.QuerySelector(".card-body p:not(.card-subtitle)")?.TextContent, StringComparison.Ordinal);
        Assert.Equal("Angular 22", card.QuerySelectorAll(".card-tags .tag").Last().TextContent);
        var button = card.QuerySelector(".card-actions button.button-primary");
        Assert.Equal("Try the patient explorer", button?.TextContent.Trim());
        Assert.Equal("#icon-data", button?.QuerySelector("use")?.GetAttribute("href"));
        var links = card.QuerySelectorAll(":scope > .card-body > .card-links > .card-link").Select(a => a.GetAttribute("href")).ToList();
        Assert.Equal(
        [
            "https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/api/src/Fhir.Api",
            "https://github.com/mvcprogrammer/mvcprogrammer.com/blob/main/api/openapi.yaml",
            "https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/fhir",
        ], links);
        Assert.Empty(card.QuerySelectorAll("details"));
        Assert.Empty(cut.FindAll("iframe"));
        Assert.Empty(module.Invocations);
    }

    /// <summary>Each project card has one primary button and a single row of links after it.</summary>
    [Fact]
    public void Render_ShouldGiveEachProjectCardOneButtonAndOneLinkRowAfterIt()
    {
        // Arrange
        this.AddSiteOptions();
        this.SetupSiteModule();

        // Act
        var cut = Render<PortfolioSection>();

        // Assert
        var cards = cut.FindAll(".portfolio-card:not(.portfolio-card-featured)");
        var actions = cards.Select(card =>
        {
            var buttons = card.QuerySelectorAll(".card-actions .button-primary");
            var rows = card.QuerySelectorAll(":scope > .card-body > .card-links");
            var rowAfterButton = buttons.Length > 0 && rows.Length > 0 && buttons[0].CompareDocumentPosition(rows[0]).HasFlag(AngleSharp.Dom.DocumentPositions.Following);
            var links = string.Join("|", rows.SelectMany(r => r.QuerySelectorAll(".card-link")).Select(a => a.TextContent.Trim()));
            return $"{buttons.Length} button, {rows.Length} row, after={rowAfterButton}: {links}";
        }).ToList();
        Assert.Equal(
        [
            "1 button, 1 row, after=True: API repo|OpenAPI spec|Explorer repo",
            "1 button, 1 row, after=True: Site repo",
            "1 button, 1 row, after=True: Screen repo|API repo",
        ], actions);
        var visit = cards[1].QuerySelector(".card-actions a.button-primary");
        Assert.Equal("https://lightsplitters.com", visit?.GetAttribute("href"));
        Assert.Equal("Visit lightsplitters.com", visit?.TextContent.Trim());
        Assert.Equal("#icon-globe", visit?.QuerySelector("use")?.GetAttribute("href"));
    }

    /// <summary>Both demo dialogs are rendered closed, each with its own id and heading.</summary>
    [Fact]
    public void Render_ShouldRenderBothDemoDialogsClosed()
    {
        // Arrange
        this.AddSiteOptions();
        this.SetupSiteModule();

        // Act
        var cut = Render<PortfolioSection>();

        // Assert
        var dialogs = cut.FindAll("dialog.demo-dialog");
        Assert.Equal(["kiosk-dialog", "fhir-dialog"], dialogs.Select(d => d.Id).ToList());
        Assert.Equal("FHIR R4 Patient Explorer", cut.Find("#fhir-dialog-title").TextContent);
        Assert.Equal("tall", cut.Find("#fhir-dialog").GetAttribute("data-frame"));
        Assert.Empty(cut.FindAll("iframe"));
    }

    #endregion

    #region Explorer Button Tests

    /// <summary>The "Try the patient explorer" button opens the explorer dialog on the configured URL, and the kiosk stays closed.</summary>
    [Fact]
    public async Task ExplorerButton_ShouldOpenExplorerDialog()
    {
        // Arrange
        this.AddSiteOptions();
        var module = this.SetupSiteModule();
        var cut = Render<PortfolioSection>();

        // Act
        await cut.Find("#fhir-api .card-actions button.button-primary").ClickAsync(new Microsoft.AspNetCore.Components.Web.MouseEventArgs());

        // Assert
        var frame = Assert.Single(cut.FindAll("iframe"));
        Assert.Equal("https://fhir.example.test/", frame.GetAttribute("src"));
        Assert.Equal("FHIR R4 Patient Explorer, live", frame.GetAttribute("title"));
        Assert.Equal("fhir-dialog", frame.Closest("dialog")?.Id);
        await cut.WaitForAssertionAsync(() => Assert.Single(module.Invocations, i => i.Identifier == "showModal"));
    }

    #endregion
}
