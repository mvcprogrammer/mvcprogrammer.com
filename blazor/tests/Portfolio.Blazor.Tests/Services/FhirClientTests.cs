using System.Net;
using System.Net.Http;
using Microsoft.Extensions.Options;
using Portfolio.Blazor.Enumerations;
using Portfolio.Blazor.Exceptions;
using Portfolio.Blazor.Services;
using Portfolio.Blazor.Tests.Fakes;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Services;

/// <summary>Tests for <see cref="FhirClient"/> over a stubbed HTTP handler.</summary>
public sealed class FhirClientTests
{
    private const string SEARCH_JSON = """
        {"count":1,"query":{"family":"Watsica"},"items":[{"id":"78785","name":"Watsica258, Kimi714","familyName":"Watsica258","givenName":"Kimi714","birthDate":"1963-03-02","birthYear":1963,"sex":"female"}],"trace":{"dataSource":{"name":"HAPI","baseUrl":"https://hapi.fhir.org/baseR4"},"requests":[{"method":"GET","url":"https://hapi.fhir.org/baseR4/Patient?family=Watsica","status":200,"durationMs":110,"entries":1,"pages":1}],"totalDurationMs":110,"bundleEntries":1,"pagesWalked":1,"pageCap":5,"truncated":false,"generatedAt":"2026-10-21T15:00:00Z"}}
        """;

    private const string SUMMARY_JSON = """
        {"patient":{"id":"78785","name":"Watsica258, Kimi714","familyName":"Watsica258","initials":"KW","sex":"female","age":63,"identifiers":[]},"counts":{"conditions":2,"encounters":31,"observations":240},"conditions":{"active":[{"display":"Essential hypertension (disorder)","code":"59621000","systemLabel":"SNOMED CT","clinicalStatus":"active"}],"resolved":[]},"vitals":[{"date":"2026-03-31","name":"Body weight","loincCode":"29463-7","value":64.6,"unit":"kg"}],"trace":{"dataSource":{"name":"HAPI","baseUrl":"https://hapi.fhir.org/baseR4"},"requests":[],"totalDurationMs":580,"bundleEntries":3,"pagesWalked":1,"pageCap":5,"truncated":false,"generatedAt":"2026-10-21T15:00:00Z"}}
        """;

    #region Constructor Tests

    /// <summary>Constructor arguments are guarded.</summary>
    [Fact]
    public void FhirClient_ShouldThrowOnNullArguments()
    {
        // Arrange
        using var http = new HttpClient();
        var options = Options.Create(BunitContextExtensions.CreateSiteOptions());

        // Act and Assert
        Assert.Throws<ArgumentNullException>(() => new FhirClient(null!, options));
        Assert.Throws<ArgumentNullException>(() => new FhirClient(http, null!));
    }

    #endregion

    #region SearchPatientsAsync Tests

    /// <summary>The family alone goes in the query string with the JSON accept header, and the body and response facts come back.</summary>
    [Fact]
    public async Task SearchPatientsAsync_ShouldRequestFamilyAndDeserializeWithResponseFacts()
    {
        // Arrange
        var handler = new StubHttpMessageHandler(_ =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(SEARCH_JSON, System.Text.Encoding.UTF8, "application/json") };
            response.Headers.TryAddWithoutValidation("x-cache", "Hit from cloudfront");
            response.Headers.ETag = new System.Net.Http.Headers.EntityTagHeaderValue("\"v1\"");
            return response;
        });
        var client = CreateClient(handler);

        // Act
        var result = await client.SearchPatientsAsync(new("Watsica", string.Empty, string.Empty), CancellationToken.None);

        // Assert
        var request = Assert.Single(handler.Requests);
        Assert.Equal("https://site.example.test/api/fhir/patients?family=Watsica", request.RequestUri?.AbsoluteUri);
        Assert.Equal("application/json, application/problem+json", request.Headers.Accept.ToString());
        var row = Assert.Single(result.Body.Items);
        Assert.Equal("78785", row.Id);
        Assert.Equal(Sex.Female, row.Sex);
        Assert.Equal(1963, row.BirthYear);
        Assert.Null(result.Body.Total);
        Assert.Equal(200, result.Status);
        Assert.Equal("Hit from cloudfront", result.XCache);
        Assert.Equal("\"v1\"", result.ETag);
        Assert.Equal("application/json; charset=utf-8", result.ContentType);
        Assert.True(result.DurationMs >= 0, "the round trip is measured");
    }

    /// <summary>Every filled parameter is escaped into the query string.</summary>
    [Fact]
    public async Task SearchPatientsAsync_ShouldEscapeEveryFilledParameter()
    {
        // Arrange
        var handler = StubHttpMessageHandler.Json(SEARCH_JSON);
        var client = CreateClient(handler);

        // Act
        await client.SearchPatientsAsync(new("O Brien", "1979-04-12", "urn:mrn|12 345"), CancellationToken.None);

        // Assert
        Assert.Equal("https://site.example.test/api/fhir/patients?family=O%20Brien&birthdate=1979-04-12&identifier=urn%3Amrn%7C12%20345", Assert.Single(handler.Requests).RequestUri?.AbsoluteUri);
    }

    /// <summary>A problem-details answer becomes a FhirProblemException carrying the detail, title, status, and cache header.</summary>
    [Fact]
    public async Task SearchPatientsAsync_ShouldThrowFhirProblemExceptionWithDetailOnErrorStatus()
    {
        // Arrange
        var handler = new StubHttpMessageHandler(_ =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.BadGateway)
            {
                Content = new StringContent("""{"title":"Bad Gateway","status":502,"detail":"The sandbox answered 500."}""", System.Text.Encoding.UTF8, "application/problem+json"),
            };
            response.Headers.TryAddWithoutValidation("x-cache", "Error from cloudfront");
            return response;
        });
        var client = CreateClient(handler);

        // Act
        var exception = await Assert.ThrowsAsync<FhirProblemException>(() => client.SearchPatientsAsync(new("Watsica", string.Empty, string.Empty), CancellationToken.None));

        // Assert
        Assert.Equal(502, exception.Status);
        Assert.Equal("Bad Gateway", exception.Title);
        Assert.Equal("The sandbox answered 500.", exception.Message);
        Assert.Equal("Error from cloudfront", exception.XCache);
        Assert.True(exception.UpstreamFailed, "502 is an upstream failure");
    }

    /// <summary>A 429 without a detail gets the rate-limit message.</summary>
    [Fact]
    public async Task SearchPatientsAsync_ShouldUseRateLimitMessageOn429()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Status(HttpStatusCode.TooManyRequests));

        // Act
        var exception = await Assert.ThrowsAsync<FhirProblemException>(() => client.SearchPatientsAsync(new("Watsica", string.Empty, string.Empty), CancellationToken.None));

        // Assert
        Assert.Equal(429, exception.Status);
        Assert.Equal(FhirProblemException.RATE_LIMIT_MESSAGE, exception.Message);
        Assert.Null(exception.Title);
    }

    /// <summary>HTML where JSON was expected (a SPA fallback page) becomes the not-JSON message with the success status.</summary>
    [Fact]
    public async Task SearchPatientsAsync_ShouldThrowNotJsonOnHtml()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Json("<!DOCTYPE html><html></html>"));

        // Act
        var exception = await Assert.ThrowsAsync<FhirProblemException>(() => client.SearchPatientsAsync(new("Watsica", string.Empty, string.Empty), CancellationToken.None));

        // Assert
        Assert.Equal(200, exception.Status);
        Assert.Equal(FhirProblemException.NOT_JSON_MESSAGE, exception.Message);
    }

    /// <summary>A JSON null body is treated the same way.</summary>
    [Fact]
    public async Task SearchPatientsAsync_ShouldThrowNotJsonOnNullBody()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Json("null"));

        // Act and Assert
        var exception = await Assert.ThrowsAsync<FhirProblemException>(() => client.SearchPatientsAsync(new("Watsica", string.Empty, string.Empty), CancellationToken.None));
        Assert.Equal(FhirProblemException.NOT_JSON_MESSAGE, exception.Message);
    }

    /// <summary>A connection failure becomes the network message with status 0 and the cause attached.</summary>
    [Fact]
    public async Task SearchPatientsAsync_ShouldThrowUnreachableOnHttpRequestException()
    {
        // Arrange
        var client = CreateClient(new StubHttpMessageHandler(_ => throw new HttpRequestException("Failed to fetch")));

        // Act
        var exception = await Assert.ThrowsAsync<FhirProblemException>(() => client.SearchPatientsAsync(new("Watsica", string.Empty, string.Empty), CancellationToken.None));

        // Assert
        Assert.Equal(0, exception.Status);
        Assert.False(exception.TimedOut, "a connection failure is not a timeout");
        Assert.Equal(FhirProblemException.NETWORK_MESSAGE, exception.Message);
        Assert.IsType<HttpRequestException>(exception.InnerException);
    }

    /// <summary>The client's own timeout (a cancellation the caller did not ask for) becomes the timeout message.</summary>
    [Fact]
    public async Task SearchPatientsAsync_ShouldThrowTimedOutOnClientTimeout()
    {
        // Arrange
        var client = CreateClient(new StubHttpMessageHandler(_ => throw new TaskCanceledException("The request was canceled due to the configured HttpClient.Timeout")));

        // Act
        var exception = await Assert.ThrowsAsync<FhirProblemException>(() => client.SearchPatientsAsync(new("Watsica", string.Empty, string.Empty), CancellationToken.None));

        // Assert
        Assert.True(exception.TimedOut, "the browser gave up waiting");
        Assert.Equal(FhirProblemException.TIMEOUT_MESSAGE, exception.Message);
    }

    /// <summary>A pre-cancelled token aborts the call with a cancellation, not a problem.</summary>
    [Fact]
    public async Task SearchPatientsAsync_ShouldThrowWhenCancelled()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Json(SEARCH_JSON));
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        // Act and Assert
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.SearchPatientsAsync(new("Watsica", string.Empty, string.Empty), cts.Token));
    }

    /// <summary>A null request is guarded.</summary>
    [Fact]
    public async Task SearchPatientsAsync_ShouldThrowOnNullRequest()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Json(SEARCH_JSON));

        // Act and Assert
        await Assert.ThrowsAsync<ArgumentNullException>(() => client.SearchPatientsAsync(null!, CancellationToken.None));
    }

    #endregion

    #region GetSummaryAsync Tests

    /// <summary>The patient id is escaped into the path and the summary deserialises, enumerations included.</summary>
    [Fact]
    public async Task GetSummaryAsync_ShouldRequestEscapedIdAndDeserialize()
    {
        // Arrange
        var handler = StubHttpMessageHandler.Json(SUMMARY_JSON);
        var client = CreateClient(handler);

        // Act
        var result = await client.GetSummaryAsync("a/b", CancellationToken.None);

        // Assert
        Assert.Equal("https://site.example.test/api/fhir/patients/a%2Fb/summary", Assert.Single(handler.Requests).RequestUri?.AbsoluteUri);
        Assert.Equal("KW", result.Body.Patient.Initials);
        Assert.Equal(ClinicalStatus.Active, Assert.Single(result.Body.Conditions.Active).ClinicalStatus);
        Assert.Equal(64.6, Assert.Single(result.Body.Vitals).Value);
        Assert.Null(Assert.Single(result.Body.Vitals).Components);
    }

    /// <summary>An unknown patient is a 404 problem.</summary>
    [Fact]
    public async Task GetSummaryAsync_ShouldThrow404ProblemForUnknownPatient()
    {
        // Arrange
        var client = CreateClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound)
        {
            Content = new StringContent("""{"title":"Not Found","status":404}""", System.Text.Encoding.UTF8, "application/problem+json"),
        }));

        // Act
        var exception = await Assert.ThrowsAsync<FhirProblemException>(() => client.GetSummaryAsync("missing", CancellationToken.None));

        // Assert
        Assert.Equal(404, exception.Status);
        Assert.Equal("Not Found", exception.Title);
        Assert.Equal("The request failed (404).", exception.Message);
    }

    /// <summary>A blank id is guarded.</summary>
    [Fact]
    public async Task GetSummaryAsync_ShouldThrowOnBlankId()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Json(SUMMARY_JSON));

        // Act and Assert
        await Assert.ThrowsAsync<ArgumentException>(() => client.GetSummaryAsync(" ", CancellationToken.None));
    }

    #endregion

    #region GetRawBundleAsync Tests

    /// <summary>The bundle is fetched as text with the FHIR accept header.</summary>
    [Fact]
    public async Task GetRawBundleAsync_ShouldRequestTextWithFhirAcceptHeader()
    {
        // Arrange
        const string bundle = "{\n  \"resourceType\": \"Bundle\"\n}";
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(bundle, System.Text.Encoding.UTF8, "application/fhir+json"),
        });
        var client = CreateClient(handler);

        // Act
        var result = await client.GetRawBundleAsync("78785", CancellationToken.None);

        // Assert
        var request = Assert.Single(handler.Requests);
        Assert.Equal("https://site.example.test/api/fhir/patients/78785/raw", request.RequestUri?.AbsoluteUri);
        Assert.Equal("application/fhir+json, application/problem+json", request.Headers.Accept.ToString());
        Assert.Equal(bundle, result.Body);
        Assert.Equal("application/fhir+json; charset=utf-8", result.ContentType);
    }

    /// <summary>An error status without a problem body gets the status message.</summary>
    [Fact]
    public async Task GetRawBundleAsync_ShouldThrowFhirProblemExceptionOnErrorStatus()
    {
        // Arrange
        var client = CreateClient(StubHttpMessageHandler.Status(HttpStatusCode.GatewayTimeout));

        // Act
        var exception = await Assert.ThrowsAsync<FhirProblemException>(() => client.GetRawBundleAsync("78785", CancellationToken.None));

        // Assert
        Assert.Equal(504, exception.Status);
        Assert.Equal(FhirProblemException.UPSTREAM_MESSAGE, exception.Message);
    }

    #endregion

    #region GetCapabilityAsync Tests

    /// <summary>The capability subset is read from the configured base and deserialised.</summary>
    [Fact]
    public async Task GetCapabilityAsync_ShouldRequestCapabilityAndDeserialize()
    {
        // Arrange
        var handler = StubHttpMessageHandler.Json("""{"ok":true,"fhirVersion":"4.0.1","software":{"name":"HAPI FHIR Server","version":"8.1.0"},"baseUrl":"https://hapi.fhir.org/baseR4","checkedAt":"2026-10-21T15:00:00Z","resources":[{"type":"Patient","supported":true,"searchParams":[{"name":"family","supported":true}]}]}""");
        var client = CreateClient(handler);

        // Act
        var result = await client.GetCapabilityAsync(CancellationToken.None);

        // Assert
        Assert.Equal("https://site.example.test/api/fhir/capability", Assert.Single(handler.Requests).RequestUri?.AbsoluteUri);
        Assert.True(result.Body.Ok, "everything is supported");
        Assert.Equal("HAPI FHIR Server", result.Body.Software?.Name);
        Assert.Equal("family", Assert.Single(Assert.Single(result.Body.Resources).SearchParams).Name);
    }

    #endregion

    #region Helper Methods

    private static FhirClient CreateClient(HttpMessageHandler handler)
    {
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://site.example.test/") };
        return new FhirClient(http, Options.Create(BunitContextExtensions.CreateSiteOptions()));
    }

    #endregion
}
