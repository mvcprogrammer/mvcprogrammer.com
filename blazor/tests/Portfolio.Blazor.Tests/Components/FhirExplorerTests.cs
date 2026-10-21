using Microsoft.AspNetCore.Components.Web;
using Portfolio.Blazor.Components;
using Portfolio.Blazor.Exceptions;
using Portfolio.Blazor.Models;
using Portfolio.Blazor.Tests.Fakes;
using Portfolio.Blazor.Tests.Helpers;
using Portfolio.Blazor.ViewModels;

namespace Portfolio.Blazor.Tests.Components;

/// <summary>Tests for <see cref="FhirExplorer"/>: the capability check, the search and its fallbacks, the summary, the raw bundle, and the log.</summary>
public sealed class FhirExplorerTests : BunitContext
{
    #region OnInitializedAsync Tests

    /// <summary>On render the component checks the capability once, logs the sandbox, prefills the example, and searches nothing.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldCheckCapabilityAndPrefillExample()
    {
        // Arrange
        var fhir = Arrange_Explorer();

        // Act
        var cut = Render<FhirExplorer>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Contains("every resource and search parameter", LogText(cut), StringComparison.Ordinal));
        Assert.Equal(1, fhir.CapabilityCalls);
        Assert.Empty(fhir.Searches);
        Assert.Equal("Programmer", cut.Find("#fhir-family").GetAttribute("value"));
        Assert.Equal("HAPI sandbox", cut.Find("[data-fhir-source]").TextContent);
        Assert.Contains("→ GET /api/fhir/capability", LogText(cut), StringComparison.Ordinal);
        Assert.Contains("← 200 /capability in 120 ms · X-Cache: Miss from cloudfront · ETag \"abc123\"", LogText(cut), StringComparison.Ordinal);
        Assert.Contains("HAPI FHIR Server 8.1.0 · FHIR 4.0.1 at https://hapi.fhir.org/baseR4", LogText(cut), StringComparison.Ordinal);
        Assert.Equal(FhirExplorer.LIST_PROMPT, cut.Find("#fhir-list-empty").TextContent);
        Assert.Equal(FhirExplorer.SUMMARY_PROMPT, cut.Find("#fhir-summary-empty").TextContent);
        Assert.True(cut.Find("#fhir-raw-toggle").HasAttribute("disabled"), "no bundle before a summary");
    }

    /// <summary>A sandbox lacking something is named and the gaps listed as an error line.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldListMissingSupport()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        fhir.OnGetCapability = () => Task.FromResult(TestData.CreateFhirResponse(TestData.CreateCapabilitySubset(
            ok: false,
            baseUrl: "https://r4.smarthealthit.org",
            software: new Software("SMART Sandbox", null),
            resources: [new ResourceSupport("Encounter", false, [new ParamSupport("patient", false)])])));

        // Act
        var cut = Render<FhirExplorer>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Contains("not supported: Encounter, Encounter?patient", LogText(cut), StringComparison.Ordinal));
        Assert.Equal("SMART Sandbox", cut.Find("[data-fhir-source]").TextContent);
        Assert.NotEmpty(cut.FindAll(".fhir-log-error"));
    }

    /// <summary>A failed capability check is logged and the explorer carries on.</summary>
    [Fact]
    public async Task OnInitializedAsync_ShouldLogFailedCapabilityCheck()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        fhir.OnGetCapability = () => Task.FromException<FhirResponse<CapabilitySubset>>(new FhirProblemException("Could not reach the API.", 0, null, 3, null, false));

        // Act
        var cut = Render<FhirExplorer>();

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Contains("capability check failed: Could not reach the API.", LogText(cut), StringComparison.Ordinal));
        Assert.Equal("HAPI sandbox", cut.Find("[data-fhir-source]").TextContent);
    }

    #endregion

    #region SearchAsync Tests

    /// <summary>The prefilled example lists the match, selects it, and renders the summary card.</summary>
    [Fact]
    public async Task SearchAsync_ShouldListSelectAndRenderSummary()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        var cut = await RenderReadyAsync();

        // Act
        await SubmitAsync(cut);

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal("Watsica258, Kimi714", cut.Find("#fhir-card-name").TextContent));
        Assert.Equal([new("Programmer", string.Empty, string.Empty)], fhir.Searches);
        Assert.Equal(["78785"], fhir.SummaryCalls);
        Assert.Equal("1 patient for “Programmer”; the first is selected.", cut.Find("#fhir-status").TextContent.Trim());
        Assert.Contains("is-ok", cut.Find("#fhir-status").ClassName, StringComparison.Ordinal);
        Assert.Equal("(1)", cut.Find("#fhir-count").TextContent);
        var row = Assert.Single(cut.FindAll(".fhir-patient"));
        Assert.Equal("true", row.GetAttribute("aria-pressed"));
        Assert.Equal("KW", row.QuerySelector(".fhir-avatar-sm")?.TextContent);
        Assert.Equal("Watsica258, Kimi714", row.QuerySelector(".fhir-patient-name")?.TextContent);
        Assert.Equal("born 1963 · female · Patient/78785", row.QuerySelector(".fhir-patient-sub")?.TextContent);
        Assert.True(cut.Find("#fhir-list-empty").HasAttribute("hidden"), "rows hide the prompt");
        Assert.Equal("female · 63 years · Patient/78785 · MRN eed8a921", cut.Find("#fhir-card-meta").TextContent);
        Assert.Equal("KW", cut.Find("#fhir-avatar").TextContent);
        Assert.Matches(@"^fhir-avatar fhir-avatar-\d$", cut.Find("#fhir-avatar").ClassName);
        Assert.Equal("2", cut.Find("#fhir-tile-conditions").TextContent);
        Assert.Equal("31", cut.Find("#fhir-tile-encounters").TextContent);
        Assert.Equal("240", cut.Find("#fhir-tile-observations").TextContent);
        Assert.Equal("false", cut.Find("#fhir-summary").GetAttribute("aria-busy"));
        Assert.False(cut.Find("#fhir-raw-toggle").HasAttribute("disabled"), "a summary enables the bundle");
    }

    /// <summary>Condition pills carry their codes and onset titles, and the resolved toggle reveals the rest.</summary>
    [Fact]
    public async Task SearchAsync_ShouldRenderConditionPillsAndResolvedToggle()
    {
        // Arrange
        Arrange_Explorer();
        var cut = await RenderReadyAsync();
        await SubmitAsync(cut);
        await cut.WaitForAssertionAsync(() => cut.Find("#fhir-card-name"));

        // Assert
        var pills = cut.FindAll("#fhir-conditions .fhir-pill");
        Assert.Equal(2, pills.Count);
        Assert.Equal("Essential hypertension (disorder)", pills[0].QuerySelector(".fhir-pill-text")?.TextContent);
        Assert.Equal("SNOMED CT 59621000", pills[0].QuerySelector(".fhir-pill-code")?.TextContent);
        Assert.Equal("Onset 2010-05-01 · active", pills[0].GetAttribute("title"));
        Assert.Equal("+1 resolved", pills[1].QuerySelector(".fhir-pill-button")?.TextContent);
        Assert.True(cut.Find("#fhir-resolved").HasAttribute("hidden"), "resolved pills start hidden");

        // Act
        cut.Find(".fhir-pill-button").Click();

        // Assert again
        Assert.Equal("hide 1 resolved", cut.Find(".fhir-pill-button").TextContent);
        Assert.Equal("true", cut.Find(".fhir-pill-button").GetAttribute("aria-expanded"));
        Assert.False(cut.Find("#fhir-resolved").HasAttribute("hidden"), "the toggle reveals them");
        Assert.Equal("Acute bronchitis (disorder)", cut.Find("#fhir-resolved .fhir-pill.is-resolved .fhir-pill-text").TextContent);
    }

    /// <summary>The vitals table shows the date and clock time, the LOINC code, and component values.</summary>
    [Fact]
    public async Task SearchAsync_ShouldRenderVitalsTable()
    {
        // Arrange
        Arrange_Explorer();
        var cut = await RenderReadyAsync();

        // Act
        await SubmitAsync(cut);

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal(2, cut.FindAll("#fhir-vitals tbody tr").Count));
        var rows = cut.FindAll("#fhir-vitals tbody tr");
        Assert.Equal("2026-03-31T10:47:00Z", rows[0].QuerySelector("time")?.GetAttribute("datetime"));
        Assert.Equal("10:47", rows[0].QuerySelector(".fhir-table-time")?.TextContent);
        Assert.Equal("85354-9", rows[0].QuerySelector(".fhir-loinc")?.TextContent);
        Assert.Equal("108/82 mm[Hg]", rows[0].QuerySelector(".fhir-table-value")?.TextContent);
        Assert.Equal("2026-03-31", rows[1].QuerySelector("time")?.TextContent);
        Assert.Equal("64.6 kg", rows[1].QuerySelector(".fhir-table-value")?.TextContent);
        Assert.True(cut.Find("#fhir-vitals-empty").HasAttribute("hidden"), "vitals hide the empty note");
    }

    /// <summary>A patient with no conditions or vitals says so.</summary>
    [Fact]
    public async Task SearchAsync_ShouldSayWhenNothingIsRecorded()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        fhir.OnGetSummary = _ => Task.FromResult(TestData.CreateFhirResponse(TestData.CreatePatientSummary(conditions: new Conditions([], []), vitals: [])));
        var cut = await RenderReadyAsync();

        // Act
        await SubmitAsync(cut);

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal("None recorded.", cut.Find("#fhir-conditions .fhir-empty-inline").TextContent));
        Assert.True(cut.Find("#fhir-vitals").HasAttribute("hidden"), "no rows, no table");
        Assert.False(cut.Find("#fhir-vitals-empty").HasAttribute("hidden"), "the empty note shows");
    }

    /// <summary>The log carries the request, the response, the upstream trace, and the mapping, and the DTO view fills.</summary>
    [Fact]
    public async Task SearchAsync_ShouldLogTraceAndShowDto()
    {
        // Arrange
        Arrange_Explorer();
        var cut = await RenderReadyAsync();

        // Act
        await SubmitAsync(cut);

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Contains("mapped to PatientSummary", LogText(cut), StringComparison.Ordinal));
        var log = LogText(cut);
        Assert.Contains("→ GET /api/fhir/patients?family=Programmer", log, StringComparison.Ordinal);
        Assert.Contains("← 200 /patients in 120 ms · X-Cache: Miss from cloudfront · ETag \"abc123\"", log, StringComparison.Ordinal);
        Assert.Contains("↳ GET https://hapi.fhir.org/baseR4/Patient?family=Programmer", log, StringComparison.Ordinal);
        Assert.Contains("200 · 110 ms · 1 entry · 1 page", log, StringComparison.Ordinal);
        Assert.Contains("1 upstream request in 110 ms wall time · 1 bundle entry · 1 page walked (cap 5 per search)", log, StringComparison.Ordinal);
        Assert.Contains("mapped to PatientSearchResult: 1 item", log, StringComparison.Ordinal);
        Assert.Contains("→ GET /api/fhir/patients/78785/summary", log, StringComparison.Ordinal);
        Assert.Contains("2 upstream requests in 580 ms wall time · 3 bundle entries", log, StringComparison.Ordinal);
        Assert.Contains("mapped to PatientSummary: 1 active and 1 resolved conditions, 2 vital signs", log, StringComparison.Ordinal);
        Assert.Equal("The PatientSummary the function returned", cut.Find("#fhir-dto-details summary").TextContent);
        Assert.Contains("\"initials\":\"KW\"", cut.Find("#fhir-dto").TextContent, StringComparison.Ordinal);
    }

    /// <summary>A cache hit is noted with the original request time.</summary>
    [Fact]
    public async Task SearchAsync_ShouldNoteCacheHit()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        fhir.OnSearchPatients = _ => Task.FromResult(TestData.CreateFhirResponse(TestData.CreatePatientSearchResult(), xCache: "Hit from cloudfront"));
        var cut = await RenderReadyAsync();

        // Act
        await SubmitAsync(cut);

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Contains("served from the CloudFront cache; the upstream numbers below are from the original request at 2026-10-21T15:00:00Z", LogText(cut), StringComparison.Ordinal));
    }

    /// <summary>A custom search sends every field trimmed and does not walk the fallback list.</summary>
    [Fact]
    public async Task SearchAsync_ShouldSendCustomFieldsWithoutFallback()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        fhir.OnSearchPatients = _ => Task.FromResult(TestData.CreateFhirResponse(TestData.CreateEmptyPatientSearchResult()));
        var cut = await RenderReadyAsync();
        cut.Find("#fhir-family").Change("Nobody");
        cut.Find("#fhir-birthdate").Change("1979-04-12");
        cut.Find("#fhir-identifier").Change(" 12345 ");

        // Act
        await SubmitAsync(cut);

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal("No matches.", cut.Find("#fhir-status").TextContent.Trim()));
        Assert.Equal([new("Nobody", "1979-04-12", "12345")], fhir.Searches);
        Assert.Equal("(0)", cut.Find("#fhir-count").TextContent);
        Assert.False(cut.Find("#fhir-list-empty").HasAttribute("hidden"), "no rows, the note shows");
        Assert.Equal(FhirExplorer.NO_MATCH_MESSAGE, cut.Find("#fhir-list-empty").TextContent);
        Assert.Equal(FhirExplorer.SUMMARY_SELECT_PROMPT, cut.Find("#fhir-summary-empty").TextContent);
        Assert.Empty(fhir.SummaryCalls);
    }

    /// <summary>When the example returns nothing the fallback families are tried in order until one hits.</summary>
    [Fact]
    public async Task SearchAsync_ShouldWalkFallbackFamilies()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        fhir.OnSearchPatients = request => Task.FromResult(TestData.CreateFhirResponse(
            request.Family == "Meridius"
                ? TestData.CreatePatientSearchResult(TestData.CreatePatientListItem(id: "9", name: "Meridius, Max", familyName: "Meridius", givenName: "Max"))
                : TestData.CreateEmptyPatientSearchResult()));
        var cut = await RenderReadyAsync();

        // Act
        await SubmitAsync(cut);

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal(["9"], fhir.SummaryCalls));
        Assert.Equal(["Programmer", "Grant", "Meridius"], fhir.Searches.Select(s => s.Family));
        Assert.Equal("Meridius", cut.Find("#fhir-family").GetAttribute("value"));
        Assert.Contains("nothing for \"Programmer\"; the sandbox may have been wiped, trying \"Grant\"", LogText(cut), StringComparison.Ordinal);
        Assert.Equal("1 patient for “Meridius”; the first is selected.", cut.Find("#fhir-status").TextContent.Trim());
    }

    /// <summary>A server total larger than the page shows as "n of total".</summary>
    [Fact]
    public async Task SearchAsync_ShouldShowTotalWhenLargerThanPage()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        fhir.OnSearchPatients = _ => Task.FromResult(TestData.CreateFhirResponse(TestData.CreatePatientSearchResult() with { Total = 42 }));
        var cut = await RenderReadyAsync();

        // Act
        await SubmitAsync(cut);

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal("(1 of 42)", cut.Find("#fhir-count").TextContent));
    }

    /// <summary>An upstream failure shows the problem message, the upstream hint, and the error line, and re-enables the form.</summary>
    [Fact]
    public async Task SearchAsync_ShouldShowUpstreamFailure()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        fhir.OnSearchPatients = _ => Task.FromException<FhirResponse<PatientSearchResult>>(new FhirProblemException(FhirProblemException.UPSTREAM_MESSAGE, 504, "Gateway Timeout", 22_000, "Error from cloudfront", false));
        var cut = await RenderReadyAsync();

        // Act
        await SubmitAsync(cut);

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal(FhirExplorer.SUMMARY_UPSTREAM_MESSAGE, cut.Find("#fhir-summary-empty").TextContent));
        Assert.Equal(FhirProblemException.UPSTREAM_MESSAGE, cut.Find("#fhir-status").TextContent.Trim());
        Assert.Contains("is-error", cut.Find("#fhir-status").ClassName, StringComparison.Ordinal);
        Assert.Equal(FhirProblemException.UPSTREAM_MESSAGE, cut.Find("#fhir-list-empty").TextContent);
        Assert.Contains("← 504 /patients: Gateway Timeout in 22000 ms · X-Cache: Error from cloudfront", LogText(cut), StringComparison.Ordinal);
        Assert.False(cut.Find("#fhir-submit").HasAttribute("disabled"), "the form is usable again");
        Assert.DoesNotContain("is-loading", cut.Find("#fhir-search").ClassName, StringComparison.Ordinal);
    }

    /// <summary>Any other failure shows nothing-to-show and a network error line.</summary>
    [Fact]
    public async Task SearchAsync_ShouldShowNetworkFailure()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        fhir.OnSearchPatients = _ => Task.FromException<FhirResponse<PatientSearchResult>>(new FhirProblemException(FhirProblemException.NETWORK_MESSAGE, 0, null, 3, null, false));
        var cut = await RenderReadyAsync();

        // Act
        await SubmitAsync(cut);

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal(FhirExplorer.SUMMARY_FAILED_MESSAGE, cut.Find("#fhir-summary-empty").TextContent));
        Assert.Contains("← network error", LogText(cut), StringComparison.Ordinal);
    }

    /// <summary>A blank family name and a malformed birth date block the search and show their messages; fixing the name clears it.</summary>
    [Fact]
    public async Task SearchAsync_ShouldRejectInvalidFormAndClearFixedField()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        var cut = await RenderReadyAsync();
        cut.Find("#fhir-family").Change("   ");
        cut.Find("#fhir-birthdate").Change("1979-4-1");

        // Act
        await SubmitAsync(cut);

        // Assert
        Assert.Empty(fhir.Searches);
        Assert.Equal(FhirSearchForm.FAMILY_REQUIRED_MESSAGE, cut.Find("#fhir-family-error").TextContent);
        Assert.Contains("is-invalid", cut.Find("#fhir-family").ClassName, StringComparison.Ordinal);
        Assert.Equal("true", cut.Find("#fhir-family").GetAttribute("aria-invalid"));
        Assert.Equal(FhirSearchForm.BIRTHDATE_FORMAT_MESSAGE, cut.Find("#fhir-birthdate-error").TextContent);

        // Act again
        cut.Find("#fhir-family").Change("Grant");

        // Assert again
        Assert.Equal(string.Empty, cut.Find("#fhir-family-error").TextContent);
        Assert.DoesNotContain("is-invalid", cut.Find("#fhir-family").ClassName, StringComparison.Ordinal);
    }

    #endregion

    #region SelectAsync Tests

    /// <summary>Choosing another row loads it, presses it, and shows a summary failure inline.</summary>
    [Fact]
    public async Task SelectAsync_ShouldLoadChosenPatientAndShowFailureInline()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        fhir.OnSearchPatients = _ => Task.FromResult(TestData.CreateFhirResponse(TestData.CreatePatientSearchResult(TestData.CreatePatientListItem(), TestData.CreatePatientListItem(id: "2", name: "Programmer, Two", givenName: "Two"))));
        var cut = await RenderReadyAsync();
        await SubmitAsync(cut);
        await cut.WaitForAssertionAsync(() => cut.Find("#fhir-card-name"));
        fhir.OnGetSummary = _ => Task.FromException<FhirResponse<PatientSummary>>(new FhirProblemException("The request failed (404).", 404, "Not Found", 30, null, false));

        // Act
        await cut.FindAll(".fhir-patient")[1].ClickAsync(new MouseEventArgs());

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal("The request failed (404).", cut.Find("#fhir-summary-empty").TextContent));
        Assert.Equal(["78785", "2"], fhir.SummaryCalls);
        var rows = cut.FindAll(".fhir-patient");
        Assert.Equal("false", rows[0].GetAttribute("aria-pressed"));
        Assert.Equal("true", rows[1].GetAttribute("aria-pressed"));
        Assert.Empty(cut.FindAll("#fhir-card"));
        Assert.True(cut.Find("#fhir-raw-toggle").HasAttribute("disabled"), "no summary, no bundle");
        Assert.Contains("← 404 /patients/2/summary: Not Found in 30 ms", LogText(cut), StringComparison.Ordinal);
    }

    /// <summary>A summary that arrives after another patient was selected is dropped.</summary>
    [Fact]
    public async Task SelectAsync_ShouldDropStaleSummary()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        var first = new TaskCompletionSource<FhirResponse<PatientSummary>>(TaskCreationOptions.RunContinuationsAsynchronously);
        fhir.OnSearchPatients = _ => Task.FromResult(TestData.CreateFhirResponse(TestData.CreatePatientSearchResult(TestData.CreatePatientListItem(), TestData.CreatePatientListItem(id: "2", name: "Programmer, Two", givenName: "Two"))));
        fhir.OnGetSummary = id => id == "78785"
            ? first.Task
            : Task.FromResult(TestData.CreateFhirResponse(TestData.CreatePatientSummary(patient: TestData.CreatePatientSummary().Patient with { Id = "2", Name = "Programmer, Two" })));
        var cut = await RenderReadyAsync();
        // The submit handler stays pending on the first summary, so it is awaited only after that resolves.
        var submit = SubmitAsync(cut);
        await cut.WaitForAssertionAsync(() => Assert.Equal(2, cut.FindAll(".fhir-patient").Count));

        // Act
        await cut.FindAll(".fhir-patient")[1].ClickAsync(new MouseEventArgs());
        await cut.WaitForAssertionAsync(() => Assert.Equal("Programmer, Two", cut.Find("#fhir-card-name").TextContent));
        first.SetResult(TestData.CreateFhirResponse(TestData.CreatePatientSummary()));
        await cut.WaitForStateAsync(() => submit.IsCompleted);

        // Assert
        Assert.Equal("Programmer, Two", cut.Find("#fhir-card-name").TextContent);
    }

    #endregion

    #region ToggleRawAsync Tests

    /// <summary>The raw bundle loads once, shows, hides, and shows again without another request.</summary>
    [Fact]
    public async Task ToggleRawAsync_ShouldLoadOnceAndToggle()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        var cut = await RenderReadyAsync();
        await SubmitAsync(cut);
        await cut.WaitForAssertionAsync(() => Assert.False(cut.Find("#fhir-raw-toggle").HasAttribute("disabled"), "summary loaded"));

        // Act
        await cut.Find("#fhir-raw-toggle").ClickAsync(new MouseEventArgs());

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Contains("\"resourceType\": \"Bundle\"", cut.Find("#fhir-raw").TextContent, StringComparison.Ordinal));
        Assert.Equal(["78785"], fhir.RawCalls);
        Assert.Equal("true", cut.Find("#fhir-raw-toggle").GetAttribute("aria-expanded"));
        Assert.False(cut.Find("#fhir-raw").HasAttribute("hidden"), "the bundle shows");
        Assert.Contains("→ GET /api/fhir/patients/78785/raw", LogText(cut), StringComparison.Ordinal);
        Assert.Contains("← 200 application/fhir+json; charset=utf-8 in 120 ms · X-Cache: Miss from cloudfront · 30 bytes", LogText(cut), StringComparison.Ordinal);

        // Act again: hide, then show without another request
        await cut.Find("#fhir-raw-toggle").ClickAsync(new MouseEventArgs());
        Assert.True(cut.Find("#fhir-raw").HasAttribute("hidden"), "hidden again");
        await cut.Find("#fhir-raw-toggle").ClickAsync(new MouseEventArgs());

        // Assert again
        Assert.Equal(["78785"], fhir.RawCalls);
        Assert.False(cut.Find("#fhir-raw").HasAttribute("hidden"), "shown from memory");
    }

    /// <summary>A failed bundle load shows its status in the raw panel.</summary>
    [Fact]
    public async Task ToggleRawAsync_ShouldShowFailureInPanel()
    {
        // Arrange
        var fhir = Arrange_Explorer();
        var cut = await RenderReadyAsync();
        await SubmitAsync(cut);
        await cut.WaitForAssertionAsync(() => Assert.False(cut.Find("#fhir-raw-toggle").HasAttribute("disabled"), "summary loaded"));
        fhir.OnGetRawBundle = _ => Task.FromException<FhirResponse<string>>(new FhirProblemException(FhirProblemException.UPSTREAM_MESSAGE, 502, "Bad Gateway", 40, null, false));

        // Act
        await cut.Find("#fhir-raw-toggle").ClickAsync(new MouseEventArgs());

        // Assert
        await cut.WaitForAssertionAsync(() => Assert.Equal("The raw bundle could not be loaded (502).", cut.Find("#fhir-raw").TextContent));
    }

    /// <summary>Before a summary is loaded the toggle is disabled, the raw panel hidden, and nothing has been requested.</summary>
    [Fact]
    public async Task ToggleRawAsync_ShouldBeDisabledBeforeSummary()
    {
        // Arrange
        var fhir = Arrange_Explorer();

        // Act
        var cut = await RenderReadyAsync();

        // Assert
        Assert.True(cut.Find("#fhir-raw-toggle").HasAttribute("disabled"), "no summary, no bundle");
        Assert.Empty(fhir.RawCalls);
        Assert.True(cut.Find("#fhir-raw").HasAttribute("hidden"), "nothing to show");
    }

    #endregion

    #region Helper Methods

    private FakeFhirClient Arrange_Explorer()
    {
        this.AddSiteOptions();
        this.SetupSiteModule();
        return this.AddFhirClient();
    }

    private async Task<IRenderedComponent<FhirExplorer>> RenderReadyAsync()
    {
        var cut = Render<FhirExplorer>();
        await cut.WaitForAssertionAsync(() => Assert.Contains("every resource and search parameter", LogText(cut), StringComparison.Ordinal));
        return cut;
    }

    private static Task SubmitAsync(IRenderedComponent<FhirExplorer> cut) => cut.Find("#fhir-search").SubmitAsync();

    private static string LogText(IRenderedComponent<FhirExplorer> cut) => cut.Find("#fhir-log").TextContent;

    #endregion
}
