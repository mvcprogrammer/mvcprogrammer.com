using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Shared.Http;
using Fhir.Api.Endpoints;
using Fhir.Api.Models;
using Fhir.Api.Tests.Fakes;
using Hl7.Fhir.Model;
using Task = System.Threading.Tasks.Task;

namespace Fhir.Api.Tests;

/// <summary>End-to-end over the in-process host with the sandbox faked. One factory per test so the recorded requests and the rate limiter start clean.</summary>
public sealed class ApiTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Search

    [Fact]
    public async Task Search_maps_one_page_with_cache_headers_and_trace()
    {
        using var factory = new FhirApiFactory();
        factory.Handler.On("/Patient?", Fixtures.Searchset(
            [Fixtures.Patient("1842"), Fixtures.Patient("1911", given: "Catherine", gender: AdministrativeGender.Female, mrn: null)],
            total: 2,
            next: "https://fhir.test/r4?_getpages=abc&_getpagesoffset=20"));
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/patients?family=Dickens", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(response.Headers.ETag);
        Assert.Equal(FhirEndpoints.CACHE_CONTROL, response.Headers.CacheControl?.ToString());

        var result = await response.Content.ReadFromJsonAsync<PatientSearchResult>(ApiJson.OPTIONS, Ct);
        Assert.NotNull(result);
        Assert.Equal(2, result.Count);
        Assert.Equal(2, result.Total);
        Assert.Equal("Dickens", result.Query.Family);
        Assert.Collection(result.Items,
            first =>
            {
                Assert.Equal("1842", first.Id);
                Assert.Equal("Dickens, Charles", first.Name);
                Assert.Equal(1979, first.BirthYear);
                Assert.Equal(Sex.Male, first.Sex);
                Assert.Equal("12345", first.Mrn);
            },
            second =>
            {
                Assert.Equal("Dickens, Catherine", second.Name);
                Assert.Null(second.Mrn);
            });

        var upstream = Assert.Single(result.Trace.Requests);
        Assert.Equal("GET", upstream.Method);
        Assert.StartsWith("https://fhir.test/r4/Patient?", upstream.Url);
        Assert.Contains("family=Dickens", upstream.Url);
        Assert.Contains("_count=20", upstream.Url);
        Assert.Equal(200, upstream.Status);
        Assert.Equal(2, upstream.Entries);
        Assert.Equal(1, upstream.Pages);
        Assert.True(result.Trace.Truncated, "a next link exists, so the one-page search is marked incomplete");
        Assert.Equal("Fake sandbox", result.Trace.DataSource.Name);

        // The search never follows the next link.
        Assert.Single(factory.Handler.Requests);
    }

    [Fact]
    public async Task Search_passes_birthdate_and_identifier_through()
    {
        using var factory = new FhirApiFactory();
        factory.Handler.On("/Patient?", Fixtures.Searchset([Fixtures.Patient()]));
        using var client = factory.CreateClient();

        var result = await client.GetFromJsonAsync<PatientSearchResult>(
            "/api/fhir/patients?family=Dickens&birthdate=1979-04-12&identifier=urn:oid:1.2.36.146.595.217.0.1|12345", ApiJson.OPTIONS, Ct);

        Assert.NotNull(result);
        var sent = Assert.Single(factory.Handler.Requests).PathAndQuery;
        Assert.Contains("birthdate=1979-04-12", sent);
        Assert.Contains("identifier=urn", sent);
        Assert.Equal("1979-04-12", result.Query.Birthdate);
        Assert.Equal("urn:oid:1.2.36.146.595.217.0.1|12345", result.Query.Identifier);
    }

    [Fact]
    public async Task Empty_search_is_an_empty_list_not_an_error()
    {
        using var factory = new FhirApiFactory();
        factory.Handler.On("/Patient?", Fixtures.Searchset([], total: 0));
        using var client = factory.CreateClient();

        var result = await client.GetFromJsonAsync<PatientSearchResult>("/api/fhir/patients?family=Nobody", ApiJson.OPTIONS, Ct);

        Assert.NotNull(result);
        Assert.Equal(0, result.Count);
        Assert.Equal(0, result.Total);
        Assert.Empty(result.Items);
        Assert.False(result.Trace.Truncated);
    }

    [Theory]
    [InlineData("/api/fhir/patients", "'family' is required")]
    [InlineData("/api/fhir/patients?family=", "'family' is required")]
    [InlineData("/api/fhir/patients?family=Dickens&birthdate=1979-4-12", "'birthdate' must be a date")]
    [InlineData("/api/fhir/patients?family=Dickens&identifier=", "'identifier' must be between")]
    public async Task Bad_search_parameters_are_400_problems(string path, string detailStart)
    {
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(path, Ct);

        var problem = await AssertProblem(response, HttpStatusCode.BadRequest, "invalid-parameter");
        Assert.StartsWith(detailStart, problem.GetProperty("detail").GetString());
        Assert.Empty(factory.Handler.Requests);
    }

    [Fact]
    public async Task Overlong_family_is_a_400_problem()
    {
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/patients?family=" + new string('x', 61), Ct);

        await AssertProblem(response, HttpStatusCode.BadRequest, "invalid-parameter");
    }

    [Fact]
    public async Task Returns_304_when_the_etag_matches()
    {
        // The raw bundle has no trace, so two renders are byte-identical. Search and summary
        // responses carry timings and a generatedAt stamp, so each origin render gets a new
        // ETag; their ETags still let browsers revalidate against CloudFront's cached copy.
        using var factory = new FhirApiFactory();
        ArrangeHealthyPatient(factory.Handler);
        using var client = factory.CreateClient();
        var first = await client.GetAsync("/api/fhir/patients/1842/raw", Ct);
        var etag = first.Headers.ETag!.ToString();

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/fhir/patients/1842/raw");
        request.Headers.TryAddWithoutValidation("If-None-Match", etag);
        var second = await client.SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
        Assert.Equal(etag, second.Headers.ETag?.ToString());
        Assert.Empty(await second.Content.ReadAsByteArrayAsync(Ct));
    }

    [Fact]
    public async Task Search_etag_changes_with_the_trace()
    {
        using var factory = new FhirApiFactory();
        factory.Handler.On("/Patient?", Fixtures.Searchset([Fixtures.Patient()]));
        using var client = factory.CreateClient();

        var first = await client.GetAsync("/api/fhir/patients?family=Dickens", Ct);
        var second = await client.GetAsync("/api/fhir/patients?family=Dickens", Ct);

        Assert.NotNull(first.Headers.ETag);
        Assert.NotNull(second.Headers.ETag);
        var a = await first.Content.ReadFromJsonAsync<PatientSearchResult>(ApiJson.OPTIONS, Ct);
        var b = await second.Content.ReadFromJsonAsync<PatientSearchResult>(ApiJson.OPTIONS, Ct);
        Assert.Equal(a!.Items, b!.Items);
        Assert.NotEqual(a.Trace.GeneratedAt, b.Trace.GeneratedAt);
    }

    #endregion

    #region Summary

    [Fact]
    public async Task Summary_maps_demographics_counts_conditions_and_vitals()
    {
        using var factory = new FhirApiFactory();
        ArrangeHealthyPatient(factory.Handler);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/patients/1842/summary", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(FhirEndpoints.CACHE_CONTROL, response.Headers.CacheControl?.ToString());
        var summary = await response.Content.ReadFromJsonAsync<PatientSummary>(ApiJson.OPTIONS, Ct);
        Assert.NotNull(summary);

        Assert.Equal("Dickens, Charles", summary.Patient.Name);
        Assert.Equal("CD", summary.Patient.Initials);
        Assert.Equal("12345", summary.Patient.Mrn);
        Assert.Equal("MR", Assert.Single(summary.Patient.Identifiers).Type);
        Assert.NotNull(summary.Patient.Age);

        Assert.Equal(3, summary.Counts.Conditions);
        Assert.Equal(14, summary.Counts.Encounters);
        Assert.Equal(212, summary.Counts.Observations);

        Assert.Collection(summary.Conditions.Active,
            diabetes =>
            {
                Assert.Equal("Type 2 diabetes mellitus", diabetes.Display);
                Assert.Equal("ICD-10-CM", diabetes.SystemLabel);
                Assert.Equal("2021-06-02", diabetes.OnsetDate);
            },
            hypertension =>
            {
                Assert.Equal("Essential hypertension", hypertension.Display);
                Assert.Equal("SNOMED CT", hypertension.SystemLabel);
                Assert.Equal("59621000", hypertension.Code);
            });
        var resolved = Assert.Single(summary.Conditions.Resolved);
        Assert.Equal("resolved", resolved.ClinicalStatus);

        // Newest first, blood pressure carrying its components, non-vital LOINC codes dropped, capped at four.
        Assert.Equal(4, summary.Vitals.Count);
        Assert.Equal("Blood pressure", summary.Vitals[0].Name);
        Assert.Equal("2025-11-03T09:14:00Z", summary.Vitals[0].Date);
        Assert.Null(summary.Vitals[0].Value);
        Assert.Collection(summary.Vitals[0].Components!,
            systolic => Assert.Equal((138m, "mm[Hg]"), (systolic.Value, systolic.Unit)),
            diastolic => Assert.Equal(86m, diastolic.Value));
        Assert.Equal("Heart rate", summary.Vitals[1].Name);
        Assert.Equal(72m, summary.Vitals[1].Value);
        Assert.DoesNotContain(summary.Vitals, v => v.LoincCode == "2093-3");

        Assert.Equal(5, summary.Trace.Requests.Count);
        Assert.Equal(6, summary.Trace.PagesWalked);
        Assert.Equal(2, summary.Trace.PageCap);
        Assert.False(summary.Trace.Truncated);
        Assert.Contains(summary.Trace.Requests, r => r.Url.Contains("Encounter?", StringComparison.Ordinal) && r.Url.Contains("_summary=count", StringComparison.Ordinal) && r.Entries == 14);
    }

    [Fact]
    public async Task Summary_follows_next_links_and_marks_the_page_cap()
    {
        using var factory = new FhirApiFactory();
        var handler = factory.Handler;
        handler.On("/Patient/1842", Fixtures.Patient());
        // Three pages of conditions; the cap is two, so the third is never fetched.
        handler.On("/Condition?", Fixtures.Searchset([Fixtures.Condition("c1", "active", "One")], total: 3, next: "https://fhir.test/r4?_getpages=cond&page=2"));
        handler.On("_getpages=cond&page=2", Fixtures.Searchset([Fixtures.Condition("c2", "active", "Two")], next: "https://fhir.test/r4?_getpages=cond&page=3"));
        handler.On("_getpages=cond&page=3", Fixtures.Searchset([Fixtures.Condition("c3", "active", "Three")]));
        handler.On("category=vital-signs", Fixtures.Searchset([]));
        handler.On("/Encounter?", Fixtures.CountOnly(0));
        handler.On("/Observation?", Fixtures.CountOnly(0));
        using var client = factory.CreateClient();

        var summary = await client.GetFromJsonAsync<PatientSummary>("/api/fhir/patients/1842/summary", ApiJson.OPTIONS, Ct);

        Assert.NotNull(summary);
        Assert.Equal(2, summary.Conditions.Active.Count);
        Assert.Equal(3, summary.Counts.Conditions);
        Assert.True(summary.Trace.Truncated, "the condition search stopped at the page cap");
        var conditions = Assert.Single(summary.Trace.Requests, r => r.Url.Contains("/Condition?", StringComparison.Ordinal));
        Assert.Equal(2, conditions.Pages);
        Assert.Equal(2, conditions.Entries);
        Assert.Equal(0, handler.CountOf("page=3"));
    }

    [Fact]
    public async Task Unknown_patient_is_a_404_problem_and_nothing_else_is_fetched()
    {
        using var factory = new FhirApiFactory();
        factory.Handler.On("/Patient/gone", FakeFhirHandler.Outcome("not here"), HttpStatusCode.NotFound);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/patients/gone/summary", Ct);

        var problem = await AssertProblem(response, HttpStatusCode.NotFound, "not-found");
        Assert.Contains("gone", problem.GetProperty("detail").GetString());
        Assert.Single(factory.Handler.Requests);
    }

    [Fact]
    public async Task Bad_patient_id_is_a_400_problem()
    {
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/patients/not%20an%20id/summary", Ct);

        await AssertProblem(response, HttpStatusCode.BadRequest, "invalid-parameter");
        Assert.Empty(factory.Handler.Requests);
    }

    #endregion

    #region Upstream failures

    [Fact]
    public async Task Upstream_timeout_is_a_504_problem_after_retries()
    {
        using var factory = new FhirApiFactory();
        factory.Handler.OnHang("/Patient?");
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/patients?family=Slow", Ct);

        var problem = await AssertProblem(response, HttpStatusCode.GatewayTimeout, "upstream-timeout");
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Contains("fhir.test", problem.GetProperty("detail").GetString());
        // First attempt plus two retries, each cut off by the attempt timeout.
        Assert.Equal(3, factory.Handler.CountOf("/Patient?"));
    }

    [Fact]
    public async Task Upstream_server_error_is_a_502_problem_after_retries()
    {
        using var factory = new FhirApiFactory();
        factory.Handler.OnServerError("/Patient?");
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/patients?family=Down", Ct);

        var problem = await AssertProblem(response, HttpStatusCode.BadGateway, "upstream-unavailable");
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Contains("503", problem.GetProperty("detail").GetString());
        Assert.Equal(3, factory.Handler.CountOf("/Patient?"));
    }

    [Fact]
    public async Task Malformed_upstream_body_is_a_502_problem_without_retry()
    {
        using var factory = new FhirApiFactory();
        factory.Handler.OnGarbage("/Patient?");
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/patients?family=Garbage", Ct);

        await AssertProblem(response, HttpStatusCode.BadGateway, "upstream-unavailable");
        Assert.Equal(1, factory.Handler.CountOf("/Patient?"));
    }

    [Fact]
    public async Task Failed_search_in_a_summary_fails_the_summary()
    {
        using var factory = new FhirApiFactory();
        var handler = factory.Handler;
        handler.On("/Patient/1842", Fixtures.Patient());
        handler.On("/Condition?", Fixtures.Searchset([]));
        handler.OnServerError("category=vital-signs");
        handler.On("/Encounter?", Fixtures.CountOnly(0));
        handler.On("/Observation?", Fixtures.CountOnly(0));
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/patients/1842/summary", Ct);

        await AssertProblem(response, HttpStatusCode.BadGateway, "upstream-unavailable");
    }

    #endregion

    #region Raw bundle

    [Fact]
    public async Task Raw_bundle_is_a_pretty_printed_collection_with_the_patient_first()
    {
        using var factory = new FhirApiFactory();
        ArrangeHealthyPatient(factory.Handler);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/patients/1842/raw", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/fhir+json", response.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(response.Headers.ETag);
        Assert.Equal(FhirEndpoints.CACHE_CONTROL, response.Headers.CacheControl?.ToString());

        var text = await response.Content.ReadAsStringAsync(Ct);
        Assert.Contains("\n  \"resourceType\": \"Bundle\"", text);
        var bundle = JsonDocument.Parse(text).RootElement;
        Assert.Equal("collection", bundle.GetProperty("type").GetString());
        var entries = bundle.GetProperty("entry").EnumerateArray().ToArray();
        Assert.Equal(bundle.GetProperty("total").GetInt32(), entries.Length);
        Assert.Equal("Patient", entries[0].GetProperty("resource").GetProperty("resourceType").GetString());
        Assert.Equal("https://fhir.test/r4/Patient/1842", entries[0].GetProperty("fullUrl").GetString());
        Assert.Equal(3, entries.Count(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "Condition"));
        Assert.Contains(entries, e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "Observation");

        // The raw endpoint does not run the two count searches.
        Assert.Equal(0, factory.Handler.CountOf("_summary=count"));
    }

    #endregion

    #region Capability and health

    [Fact]
    public async Task Capability_reports_the_subset_and_is_read_once_per_instance()
    {
        using var factory = new FhirApiFactory();
        factory.Handler.On("/metadata", Fixtures.Capability("Patient", "Condition", "Observation", "Encounter"));
        using var client = factory.CreateClient();

        var first = await client.GetAsync("/api/fhir/capability", Ct);
        var second = await client.GetFromJsonAsync<CapabilitySubset>("/api/fhir/capability", ApiJson.OPTIONS, Ct);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(FhirEndpoints.CAPABILITY_CACHE_CONTROL, first.Headers.CacheControl?.ToString());
        Assert.NotNull(second);
        Assert.True(second.Ok, "every required resource and parameter is declared");
        Assert.Equal("4.0.1", second.FhirVersion);
        Assert.Equal("Fake FHIR Server", second.Software.Name);
        Assert.Equal("https://fhir.test/r4", second.BaseUrl);
        Assert.Equal(4, second.Resources.Count);
        Assert.All(second.Resources, r => Assert.True(r.Supported));
        Assert.Equal(1, factory.Handler.CountOf("/metadata"));
    }

    [Fact]
    public async Task Capability_flags_a_missing_resource_or_parameter()
    {
        using var factory = new FhirApiFactory();
        factory.Handler.On("/metadata", Fixtures.Capability("Patient", "Condition", "Observation"));
        using var client = factory.CreateClient();

        var subset = await client.GetFromJsonAsync<CapabilitySubset>("/api/fhir/capability", ApiJson.OPTIONS, Ct);

        Assert.NotNull(subset);
        Assert.False(subset.Ok, "Encounter is not declared");
        var encounter = Assert.Single(subset.Resources, r => r.Type == "Encounter");
        Assert.False(encounter.Supported);
        Assert.All(encounter.SearchParams, p => Assert.False(p.Supported));
        Assert.True(Assert.Single(subset.Resources, r => r.Type == "Patient").Supported);
    }

    [Fact]
    public async Task Health_is_never_cached_and_never_calls_upstream()
    {
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/health", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        var health = await response.Content.ReadFromJsonAsync<Health>(ApiJson.OPTIONS, Ct);
        Assert.Equal(("ok", "1.1.0-test"), (health!.Status, health.Version));
        Assert.Empty(factory.Handler.Requests);
    }

    [Fact]
    public async Task Unknown_route_is_a_404_problem()
    {
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/fhir/nothing", Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    #endregion

    #region Rate limit

    [Fact]
    public async Task Rate_limit_answers_429_with_retry_after_per_address()
    {
        using var factory = new FhirApiFactory(new Dictionary<string, string> { ["Fhir:RateLimitBudget"] = "2" });
        factory.Handler.On("/Patient?", Fixtures.Searchset([]));
        using var client = factory.CreateClient();

        var first = await client.SendAsync(From("203.0.113.7", "/api/fhir/patients?family=A"), Ct);
        var second = await client.SendAsync(From("203.0.113.7", "/api/fhir/patients?family=A"), Ct);
        var third = await client.SendAsync(From("203.0.113.7", "/api/fhir/patients?family=A"), Ct);
        var other = await client.SendAsync(From("198.51.100.9", "/api/fhir/patients?family=A"), Ct);
        var health = await client.SendAsync(From("203.0.113.7", "/api/fhir/health"), Ct);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var problem = await AssertProblem(third, HttpStatusCode.TooManyRequests, "rate-limited");
        Assert.NotNull(third.Headers.RetryAfter?.Delta);
        Assert.InRange(third.Headers.RetryAfter!.Delta!.Value.TotalSeconds, 1, 600);
        Assert.Equal("no-store", third.Headers.CacheControl?.ToString());
        Assert.Contains("2 requests", problem.GetProperty("detail").GetString());
        Assert.Equal(HttpStatusCode.OK, other.StatusCode);
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);
        // The limited request never reached the sandbox.
        Assert.Equal(3, factory.Handler.CountOf("/Patient?"));
    }

    #endregion

    #region Helper Methods

    /// <summary>A patient with three conditions (two active, one resolved), vitals across two pages, and counts.</summary>
    private static void ArrangeHealthyPatient(FakeFhirHandler handler)
    {
        handler.On("/Patient/1842", Fixtures.Patient());
        handler.On("/Condition?", Fixtures.Searchset(
        [
            Fixtures.Condition("c1", "active", "Essential hypertension"),
            Fixtures.Condition("c2", "resolved", "Acute bronchitis", code: "10509002", onset: "2024-01-15"),
            Fixtures.Condition("c3", "active", "Type 2 diabetes mellitus", code: "E11.9", system: Fixtures.ICD10_CM, onset: "2021-06-02"),
        ], total: 3));
        handler.On("category=vital-signs", Fixtures.Searchset(
        [
            Fixtures.BloodPressure("o1", "2025-11-03T09:14:00Z", 138, 86),
            Fixtures.Vital("o2", "8867-4", "2025-11-03T09:14:00Z", 72, "/min"),
            Fixtures.Vital("o3", "2093-3", "2025-11-03T09:14:00Z", 190, "mg/dL"),
        ], next: "https://fhir.test/r4?_getpages=vitals&page=2"));
        handler.On("_getpages=vitals&page=2", Fixtures.Searchset(
        [
            Fixtures.Vital("o4", "29463-7", "2025-05-01", 84.3m, "kg"),
            Fixtures.Vital("o5", "8302-2", "2025-05-01", 178, "cm"),
            Fixtures.Vital("o6", "8310-5", "2024-12-20", 36.8m, "Cel"),
        ]));
        handler.On("/Encounter?", Fixtures.CountOnly(14));
        handler.On("/Observation?", Fixtures.CountOnly(212));
    }

    private static HttpRequestMessage From(string address, string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.TryAddWithoutValidation("X-Forwarded-For", $"{address}, 130.176.0.1");
        return request;
    }

    private static async Task<JsonElement> AssertProblem(HttpResponseMessage response, HttpStatusCode status, string typeSuffix)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal((int)status, problem.GetProperty("status").GetInt32());
        Assert.EndsWith("/" + typeSuffix, problem.GetProperty("type").GetString());
        return problem;
    }

    #endregion
}
