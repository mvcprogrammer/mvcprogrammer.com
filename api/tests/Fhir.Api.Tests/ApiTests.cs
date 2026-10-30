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

        var result = await response.Content.ReadFromJsonAsync<PatientSearchResult>(ApiJson.Options, Ct);
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
            "/api/fhir/patients?family=Dickens&birthdate=1979-04-12&identifier=urn:oid:1.2.36.146.595.217.0.1|12345", ApiJson.Options, Ct);

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

        var result = await client.GetFromJsonAsync<PatientSearchResult>("/api/fhir/patients?family=Nobody", ApiJson.Options, Ct);

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
        var a = await first.Content.ReadFromJsonAsync<PatientSearchResult>(ApiJson.Options, Ct);
        var b = await second.Content.ReadFromJsonAsync<PatientSearchResult>(ApiJson.Options, Ct);
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
        var summary = await response.Content.ReadFromJsonAsync<PatientSummary>(ApiJson.Options, Ct);
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

        var summary = await client.GetFromJsonAsync<PatientSummary>("/api/fhir/patients/1842/summary", ApiJson.Options, Ct);

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
        var second = await client.GetFromJsonAsync<CapabilitySubset>("/api/fhir/capability", ApiJson.Options, Ct);

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

        var subset = await client.GetFromJsonAsync<CapabilitySubset>("/api/fhir/capability", ApiJson.Options, Ct);

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
        var health = await response.Content.ReadFromJsonAsync<Health>(ApiJson.Options, Ct);
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

    #region Writes

    private const string SESSION = "6f1d2c3b-9a8e-4b7c-9d6e-5f4a3b2c1d0e";
    private const string OTHER_SESSION = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";
    private const string KEY = "0c9b8a7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";
    private const string INPUT = """{"familyName":"Dickens","givenName":"Charles","sex":"male","birthDate":"1979-04-12","mrn":"MVC-0042"}""";

    /// <summary>A patient as the sandbox stores one the explorer created: the input plus the session and idempotency identifiers.</summary>
    private static Patient Created(string id = "1842", string session = SESSION, string key = KEY)
    {
        var patient = Fixtures.Patient(id, mrn: null);
        patient.Identifier.Add(new Hl7.Fhir.Model.Identifier("https://mvcprogrammer.com/fhir/mrn", "MVC-0042") { Type = new CodeableConcept(Fixtures.V2_0203, "MR") });
        patient.Identifier.Add(new Hl7.Fhir.Model.Identifier("https://mvcprogrammer.com/fhir/demo-session", session));
        patient.Identifier.Add(new Hl7.Fhir.Model.Identifier("https://mvcprogrammer.com/fhir/idempotency", key));
        return patient;
    }

    private static HttpRequestMessage Write(HttpMethod method, string path, string? body = null, string? session = SESSION, string? key = null, string mediaType = "application/json")
    {
        var request = new HttpRequestMessage(method, path);
        if (session is not null)
        {
            request.Headers.Add("X-Demo-Session", session);
        }

        if (key is not null)
        {
            request.Headers.Add("Idempotency-Key", key);
        }

        if (body is not null)
        {
            request.Content = new StringContent(body, System.Text.Encoding.UTF8, mediaType);
        }

        return request;
    }

    [Fact]
    public async Task Create_is_a_conditional_create_on_the_key_and_answers_201_with_location()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient?_summary=count", Fixtures.CountOnly(0));
        factory.Handler.On(HttpMethod.Post, "/Patient", Created(), HttpStatusCode.Created);
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Post, "/api/fhir/patients", INPUT, key: KEY), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("/api/fhir/patients/1842/summary", response.Headers.Location?.ToString());
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Null(response.Headers.ETag);
        var result = await response.Content.ReadFromJsonAsync<PatientWriteResult>(ApiJson.Options, Ct);
        Assert.NotNull(result);
        Assert.Equal("Dickens, Charles", result.Patient.Name);
        Assert.Equal("MVC-0042", result.Patient.Mrn);
        Assert.Contains(result.Patient.Identifiers, i => i.System == "https://mvcprogrammer.com/fhir/demo-session" && i.Value == SESSION);
        Assert.Equal(["GET", "POST"], result.Trace.Requests.Select(r => r.Method));

        var post = Assert.Single(factory.Handler.Sent, r => r.Method == HttpMethod.Post);
        Assert.Equal("identifier=https%3A%2F%2Fmvcprogrammer.com%2Ffhir%2Fidempotency%7C" + KEY, post.IfNoneExist);
        Assert.Contains("\"family\":\"Dickens\"", post.Body);
        Assert.Contains(SESSION, post.Body);
        Assert.Contains(KEY, post.Body);
        Assert.DoesNotContain("\"id\"", post.Body);
    }

    [Fact]
    public async Task Create_with_a_used_key_answers_200_and_creates_nothing()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient?_summary=count", Fixtures.CountOnly(1));
        factory.Handler.On(HttpMethod.Post, "/Patient", Created(), HttpStatusCode.OK);
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Post, "/api/fhir/patients", INPUT, key: KEY), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("/api/fhir/patients/1842/summary", response.Headers.Location?.ToString());
        var result = await response.Content.ReadFromJsonAsync<PatientWriteResult>(ApiJson.Options, Ct);
        Assert.Equal("1842", result?.Patient.Id);
    }

    /// <summary>The same bodiless 200 on a patient create: the function reads the patient the Location names and answers 200.</summary>
    [Fact]
    public async Task Create_ShouldReadTheMatchedPatientWhenTheSandboxAnswers200WithoutABody()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient?_summary=count", Fixtures.CountOnly(1));
        factory.Handler.On(HttpMethod.Post, "/Patient", (_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Headers = { Location = new Uri("https://fhir.test/r4/Patient/1842/_history/3") },
        }));
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Post, "/api/fhir/patients", INPUT, key: KEY), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("/api/fhir/patients/1842/summary", response.Headers.Location?.ToString());
        var result = await response.Content.ReadFromJsonAsync<PatientWriteResult>(ApiJson.Options, Ct);
        Assert.Equal("1842", result?.Patient.Id);
        Assert.Equal(["GET", "POST", "GET"], result!.Trace.Requests.Select(r => r.Method));
    }

    [Theory]
    [InlineData(null, KEY, INPUT, "X-Demo-Session")]
    [InlineData("not-a-uuid", KEY, INPUT, "X-Demo-Session")]
    [InlineData(SESSION, null, INPUT, "Idempotency-Key")]
    [InlineData(SESSION, KEY, """{"givenName":"Charles"}""", "familyName")]
    [InlineData(SESSION, KEY, """{"familyName":"Dickens","birthDate":"2999-01-01"}""", "birthDate")]
    [InlineData(SESSION, KEY, """{"familyName":"Dickens","mrn":"has space"}""", "mrn")]
    [InlineData(SESSION, KEY, "not json", "body")]
    public async Task Create_rejects_bad_headers_and_bodies_with_a_validation_problem(string? session, string? key, string body, string field)
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Post, "/api/fhir/patients", body, session, key), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.BadRequest, "validation-failed");
        Assert.True(problem.GetProperty("errors").TryGetProperty(field, out var messages), $"expected an error for {field}");
        Assert.NotEmpty(messages.EnumerateArray());
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Empty(factory.Handler.Requests);
    }

    [Fact]
    public async Task Create_answers_429_once_the_session_has_its_patients()
    {
        // Arrange
        using var factory = new FhirApiFactory(new Dictionary<string, string> { ["Fhir:MaxPatientsPerSession"] = "2" });
        factory.Handler.On(HttpMethod.Get, "/Patient?_summary=count", Fixtures.CountOnly(2));
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Post, "/api/fhir/patients", INPUT, key: KEY), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.TooManyRequests, "rate-limited");
        Assert.Contains("2 patients", problem.GetProperty("detail").GetString());
        Assert.NotNull(response.Headers.RetryAfter?.Delta);
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Post);
    }

    [Fact]
    public async Task Replace_rewrites_the_demographics_and_keeps_the_session_identifiers()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Put, "/Patient/1842", (request, _, ct) => Echo(request, ct));
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Put, "/api/fhir/patients/1842", """{"familyName":"Dickens","givenName":"Chuck","sex":"male"}"""), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        var result = await response.Content.ReadFromJsonAsync<PatientWriteResult>(ApiJson.Options, Ct);
        Assert.NotNull(result);
        Assert.Equal("Dickens, Chuck", result.Patient.Name);
        Assert.Null(result.Patient.BirthDate);
        Assert.Null(result.Patient.Mrn);
        Assert.Equal(["GET", "PUT"], result.Trace.Requests.Select(r => r.Method));

        var put = Assert.Single(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
        Assert.Contains("\"id\":\"1842\"", put.Body);
        Assert.Contains(SESSION, put.Body);
        Assert.Contains(KEY, put.Body);
        Assert.DoesNotContain("MVC-0042", put.Body);
    }

    [Fact]
    public async Task Replace_of_the_seeded_patient_is_a_403_problem_without_touching_the_sandbox()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Put, "/api/fhir/patients/mvc-programmer", INPUT), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.Forbidden, "read-only");
        Assert.Contains("seeded demo patient", problem.GetProperty("detail").GetString());
        Assert.Empty(factory.Handler.Requests);
    }

    [Theory]
    [InlineData("other-session")]
    [InlineData("not-created-by-the-explorer")]
    [InlineData("missing")]
    public async Task Writes_to_a_patient_that_is_not_this_sessions_are_404_problems(string which)
    {
        // Arrange
        using var factory = new FhirApiFactory();
        switch (which)
        {
            case "other-session":
                factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created(session: OTHER_SESSION));
                break;
            case "not-created-by-the-explorer":
                factory.Handler.On(HttpMethod.Get, "/Patient/1842", Fixtures.Patient("1842"));
                break;
            default:
                factory.Handler.On(HttpMethod.Get, "/Patient/1842", FakeFhirHandler.Outcome("no such patient"), HttpStatusCode.NotFound);
                break;
        }

        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Put, "/api/fhir/patients/1842", INPUT), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.NotFound, "not-found");
        Assert.Contains("This session created no Patient with id '1842'", problem.GetProperty("detail").GetString());
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
    }

    [Fact]
    public async Task Patch_applies_the_operations_to_the_input_view_and_writes_the_result()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Put, "/Patient/1842", (request, _, ct) => Echo(request, ct));
        using var client = factory.CreateClient();
        const string patch = """[{"op":"test","path":"/givenName","value":"Charles"},{"op":"replace","path":"/givenName","value":"Chuck"},{"op":"remove","path":"/mrn"}]""";

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Patch, "/api/fhir/patients/1842", patch, mediaType: "application/json-patch+json"), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<PatientWriteResult>(ApiJson.Options, Ct);
        Assert.NotNull(result);
        Assert.Equal("Dickens, Chuck", result.Patient.Name);
        Assert.Equal("1979-04-12", result.Patient.BirthDate);
        Assert.Null(result.Patient.Mrn);
        var put = Assert.Single(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
        Assert.Contains(SESSION, put.Body);
    }

    [Theory]
    [InlineData("""[{"op":"test","path":"/givenName","value":"Nobody"}]""", "'test' on /givenName) failed")]
    [InlineData("""[{"op":"replace","path":"/address","value":"x"}]""", "not a PatientInput property")]
    [InlineData("""[{"op":"replace","path":"/sex","value":"robot"}]""", "use male, female, other, or unknown")]
    public async Task Patch_that_cannot_be_applied_is_a_409_problem_and_writes_nothing(string patch, string detailPart)
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Patch, "/api/fhir/patients/1842", patch, mediaType: "application/json-patch+json"), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.Conflict, "conflict");
        Assert.Contains(detailPart, problem.GetProperty("detail").GetString());
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
    }

    [Fact]
    public async Task Patch_that_leaves_the_patient_invalid_is_a_validation_problem()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Patch, "/api/fhir/patients/1842", """[{"op":"remove","path":"/familyName"}]""", mediaType: "application/json-patch+json"), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.BadRequest, "validation-failed");
        Assert.True(problem.GetProperty("errors").TryGetProperty("familyName", out _));
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
    }

    [Fact]
    public async Task Patch_in_the_wrong_media_type_is_a_415_problem()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Patch, "/api/fhir/patients/1842", "[]"), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.UnsupportedMediaType, "unsupported-media-type");
        Assert.Contains("application/json-patch+json", problem.GetProperty("detail").GetString());
        Assert.Empty(factory.Handler.Requests);
    }

    [Fact]
    public async Task Delete_answers_204_and_again_once_the_sandbox_reports_the_patient_gone()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        var deleted = false;
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", (_, _, _) => Task.FromResult(deleted
            ? FakeFhirHandler.Json(FakeFhirHandler.Outcome("gone"), HttpStatusCode.Gone)
            : FakeFhirHandler.Json(Created())));
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.Searchset([]));
        factory.Handler.On(HttpMethod.Delete, "/Patient/1842", (_, _, _) =>
        {
            deleted = true;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NoContent));
        });
        using var client = factory.CreateClient();

        // Act
        var first = await client.SendAsync(Write(HttpMethod.Delete, "/api/fhir/patients/1842"), Ct);
        var second = await client.SendAsync(Write(HttpMethod.Delete, "/api/fhir/patients/1842"), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal("no-store", first.Headers.CacheControl?.ToString());
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
        Assert.Single(factory.Handler.Sent, r => r.Method == HttpMethod.Delete);
    }

    /// <summary>The cascade: every condition that references the patient is deleted first, in the order the sandbox listed them, then the patient.</summary>
    [Fact]
    public async Task Delete_ShouldRemoveThePatientsConditionsFirst()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.Searchset(
        [
            Fixtures.Condition("c1", "active", "Essential hypertension"),
            Fixtures.Condition("c2", "resolved", "Acute bronchitis", code: "10509002"),
        ], total: 2));
        factory.Handler.OnStatus(HttpMethod.Delete, "/Condition/", HttpStatusCode.NoContent);
        factory.Handler.OnStatus(HttpMethod.Delete, "/Patient/1842", HttpStatusCode.NoContent);
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Delete, "/api/fhir/patients/1842"), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var deletes = factory.Handler.Sent.Where(r => r.Method == HttpMethod.Delete).Select(r => r.Uri.AbsolutePath).ToArray();
        Assert.Equal(["/r4/Condition/c1", "/r4/Condition/c2", "/r4/Patient/1842"], deletes);
        var search = Assert.Single(factory.Handler.Sent, r => r.Uri.PathAndQuery.Contains("/Condition?", StringComparison.Ordinal));
        Assert.Contains("patient=Patient%2F1842", search.Uri.Query, StringComparison.Ordinal);
        Assert.Contains("_count=", search.Uri.Query, StringComparison.Ordinal);
    }

    /// <summary>A condition the sandbox already reports gone is skipped, not an error, so a retry after a partial failure completes.</summary>
    [Fact]
    public async Task Delete_ShouldSkipAConditionAlreadyGone()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.Searchset([Fixtures.Condition("c1", "active", "Essential hypertension")]));
        factory.Handler.On(HttpMethod.Delete, "/Condition/c1", FakeFhirHandler.Outcome("gone"), HttpStatusCode.Gone);
        factory.Handler.OnStatus(HttpMethod.Delete, "/Patient/1842", HttpStatusCode.NoContent);
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Delete, "/api/fhir/patients/1842"), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Single(factory.Handler.Sent, r => r.Method == HttpMethod.Delete && r.Uri.AbsolutePath == "/r4/Patient/1842");
    }

    /// <summary>A condition delete that fails upstream stops the cascade: 502, and the patient is never deleted, so nothing is half gone.</summary>
    [Fact]
    public async Task Delete_ShouldLeaveThePatientWhenAConditionDeleteFails()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.Searchset(
        [
            Fixtures.Condition("c1", "active", "Essential hypertension"),
            Fixtures.Condition("c2", "resolved", "Acute bronchitis", code: "10509002"),
        ]));
        factory.Handler.OnStatus(HttpMethod.Delete, "/Condition/c1", HttpStatusCode.NoContent);
        factory.Handler.OnServerError("/Condition/c2");
        factory.Handler.OnStatus(HttpMethod.Delete, "/Patient/1842", HttpStatusCode.NoContent);
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Delete, "/api/fhir/patients/1842"), Ct);

        // Assert
        await AssertProblem(response, HttpStatusCode.BadGateway, "upstream-unavailable");
        Assert.Single(factory.Handler.Sent, r => r.Method == HttpMethod.Delete && r.Uri.AbsolutePath == "/r4/Condition/c1");
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Delete && r.Uri.AbsolutePath == "/r4/Patient/1842");
    }

    [Fact]
    public async Task Delete_of_the_seeded_patient_is_a_403_problem()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Delete, "/api/fhir/patients/mvc-programmer"), Ct);

        // Assert
        await AssertProblem(response, HttpStatusCode.Forbidden, "read-only");
        Assert.Empty(factory.Handler.Requests);
    }

    [Fact]
    public async Task Write_budget_is_separate_from_the_read_budget()
    {
        // Arrange
        using var factory = new FhirApiFactory(new Dictionary<string, string> { ["Fhir:WriteRateLimitBudget"] = "1" });
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Put, "/Patient/1842", (request, _, ct) => Echo(request, ct));
        factory.Handler.On(HttpMethod.Get, "/Patient?", Fixtures.Searchset([]));
        using var client = factory.CreateClient();

        // Act
        var first = await client.SendAsync(Write(HttpMethod.Put, "/api/fhir/patients/1842", INPUT), Ct);
        var second = await client.SendAsync(Write(HttpMethod.Put, "/api/fhir/patients/1842", INPUT), Ct);
        var read = await client.GetAsync("/api/fhir/patients?family=A", Ct);

        // Assert
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var problem = await AssertProblem(second, HttpStatusCode.TooManyRequests, "rate-limited");
        Assert.Contains("1 writes", problem.GetProperty("detail").GetString());
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
    }

    [Fact]
    public async Task Create_when_the_sandbox_is_down_is_a_502_problem()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient?_summary=count", Fixtures.CountOnly(0));
        factory.Handler.OnServerError("/Patient");
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Write(HttpMethod.Post, "/api/fhir/patients", INPUT, key: KEY), Ct);

        // Assert
        await AssertProblem(response, HttpStatusCode.BadGateway, "upstream-unavailable");
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    /// <summary>Answers a PUT with the resource it was sent, as the sandbox does.</summary>
    private static async Task<HttpResponseMessage> Echo(HttpRequestMessage request, CancellationToken ct)
    {
        var body = await request.Content!.ReadAsStringAsync(ct);
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(body, System.Text.Encoding.UTF8, "application/fhir+json"),
        };
    }

    #endregion

    #region Conditions

    private const string HYPERTENSION = """{"code":"59621000"}""";

    /// <summary>The Condition the sandbox stores for an add: the pick-list coding, active, with an id of its own.</summary>
    private static Condition Stored(string id = "9f1c", string status = "active") =>
        Fixtures.Condition(id, status, "Essential hypertension", onset: null);

    private static HttpRequestMessage AddCondition(string body = HYPERTENSION, string? session = SESSION, string patientId = "1842") =>
        Write(HttpMethod.Post, $"/api/fhir/patients/{patientId}/conditions", body, session);

    /// <summary>The happy path: the guard reads the patient, the cap counts the active conditions, and a conditional create records the condition.</summary>
    [Fact]
    public async Task AddCondition_ShouldRecordAnActiveConditionAndAnswer201WithLocation()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.CountOnly(2));
        factory.Handler.On(HttpMethod.Post, "/Condition", Stored(), HttpStatusCode.Created);
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("/api/fhir/patients/1842/summary", response.Headers.Location?.ToString());
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        var result = await response.Content.ReadFromJsonAsync<ConditionWriteResult>(ApiJson.Options, Ct);
        Assert.NotNull(result);
        Assert.Equal("9f1c", result.Condition.Id);
        Assert.Equal("59621000", result.Condition.Code);
        Assert.Equal("Essential hypertension", result.Condition.Display);
        Assert.Equal("SNOMED CT", result.Condition.SystemLabel);
        Assert.Equal("active", result.Condition.ClinicalStatus);
        Assert.Equal(["GET", "GET", "POST"], result.Trace.Requests.Select(r => r.Method));

        var count = Assert.Single(factory.Handler.Sent, r => r.Uri.PathAndQuery.Contains("/Condition?", StringComparison.Ordinal));
        Assert.Contains("_summary=count", count.Uri.Query, StringComparison.Ordinal);
        Assert.Contains("clinical-status=active", count.Uri.Query, StringComparison.Ordinal);
        Assert.Contains("patient=Patient%2F1842", count.Uri.Query, StringComparison.Ordinal);

        var post = Assert.Single(factory.Handler.Sent, r => r.Method == HttpMethod.Post);
        Assert.Equal("patient=Patient%2F1842&clinical-status=active&code=http%3A%2F%2Fsnomed.info%2Fsct%7C59621000", post.IfNoneExist);
        Assert.Contains("\"code\":\"59621000\"", post.Body, StringComparison.Ordinal);
        Assert.Contains("\"display\":\"Essential hypertension\"", post.Body, StringComparison.Ordinal);
        Assert.Contains("\"reference\":\"Patient/1842\"", post.Body, StringComparison.Ordinal);
        Assert.Contains("problem-list-item", post.Body, StringComparison.Ordinal);
        Assert.Contains("\"recordedDate\":\"", post.Body, StringComparison.Ordinal);
        Assert.DoesNotContain("\"id\"", post.Body, StringComparison.Ordinal);
    }

    /// <summary>The sandbox answers a matched conditional create with 200 and the existing resource; the function passes that through and creates nothing.</summary>
    /// <summary>HAPI answers a matched conditional create with 200, no body, and the existing resource's Location; the function reads that resource and still answers 200.</summary>
    [Fact]
    public async Task AddCondition_ShouldReadTheMatchedConditionWhenTheSandboxAnswers200WithoutABody()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.CountOnly(1));
        factory.Handler.On(HttpMethod.Post, "/Condition", (_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Headers = { Location = new Uri("https://fhir.test/r4/Condition/9f1c/_history/1") },
        }));
        factory.Handler.On(HttpMethod.Get, "/Condition/9f1c", Stored());
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ConditionWriteResult>(ApiJson.Options, Ct);
        Assert.NotNull(result);
        Assert.Equal("9f1c", result.Condition.Id);
        Assert.Equal("Essential hypertension", result.Condition.Display);
        Assert.Equal(["GET", "GET", "POST", "GET"], result.Trace.Requests.Select(r => r.Method));
        Assert.Equal(0, result.Trace.Requests[2].Entries);
    }

    /// <summary>A bodiless 200 without a usable Location is the sandbox misbehaving, and stays a 502.</summary>
    [Fact]
    public async Task AddCondition_ShouldAnswer502WhenAMatchedCreateNamesNoResource()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.CountOnly(1));
        factory.Handler.OnStatus(HttpMethod.Post, "/Condition", HttpStatusCode.OK);
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.BadGateway, "upstream-unavailable");
        Assert.Contains("without the resource", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task AddCondition_ShouldAnswer200WhenThePatientAlreadyHasItActive()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.CountOnly(1));
        factory.Handler.On(HttpMethod.Post, "/Condition", Stored(), HttpStatusCode.OK);
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("/api/fhir/patients/1842/summary", response.Headers.Location?.ToString());
        var result = await response.Content.ReadFromJsonAsync<ConditionWriteResult>(ApiJson.Options, Ct);
        Assert.Equal("9f1c", result?.Condition.Id);
    }

    /// <summary>A missing or malformed header or body is a 400 validation problem naming the field, before anything goes upstream.</summary>
    [Theory]
    [InlineData(null, HYPERTENSION, "X-Demo-Session")]
    [InlineData("not-a-uuid", HYPERTENSION, "X-Demo-Session")]
    [InlineData(SESSION, "{}", "code")]
    [InlineData(SESSION, """{"code":"hypertension"}""", "code")]
    [InlineData(SESSION, """{"code":"123"}""", "code")]
    [InlineData(SESSION, "not json", "body")]
    public async Task AddCondition_ShouldRejectBadHeadersAndBodiesWithAValidationProblem(string? session, string body, string field)
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(body, session), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.BadRequest, "validation-failed");
        Assert.True(problem.GetProperty("errors").TryGetProperty(field, out var messages), $"expected an error for {field}");
        Assert.NotEmpty(messages.EnumerateArray());
        Assert.Empty(factory.Handler.Requests);
    }

    /// <summary>A path id that is not a FHIR id is a 400 before any header or body is read.</summary>
    [Fact]
    public async Task AddCondition_ShouldRejectAMalformedPatientId()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(patientId: "not%20an%20id"), Ct);

        // Assert
        await AssertProblem(response, HttpStatusCode.BadRequest, "invalid-parameter");
        Assert.Empty(factory.Handler.Requests);
    }

    /// <summary>A well-formed code that is not one of the ten is a 422, decided before the sandbox is asked anything.</summary>
    [Fact]
    public async Task AddCondition_ShouldAnswer422ForACodeOffThePickList()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition("""{"code":"123456"}"""), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.UnprocessableEntity, "condition-rejected");
        Assert.Equal("Condition rejected", problem.GetProperty("title").GetString());
        Assert.Contains("'123456' is not on the pick list", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Empty(factory.Handler.Requests);
    }

    /// <summary>The cap is counted on the sandbox; at the cap the add is a 422 and nothing is posted.</summary>
    [Fact]
    public async Task AddCondition_ShouldAnswer422OnceThePatientHoldsItsActiveConditions()
    {
        // Arrange
        using var factory = new FhirApiFactory(new Dictionary<string, string> { ["Fhir:MaxActiveConditionsPerPatient"] = "3" });
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.CountOnly(3));
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.UnprocessableEntity, "condition-rejected");
        Assert.Contains("already has 3 active conditions", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Post);
    }

    /// <summary>The seeded patient is read-only for conditions too, and the refusal costs no upstream call.</summary>
    [Fact]
    public async Task AddCondition_ShouldAnswer403ForTheSeededPatientWithoutTouchingTheSandbox()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(patientId: "mvc-programmer"), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.Forbidden, "read-only");
        Assert.Contains("seeded demo patient", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
        Assert.Empty(factory.Handler.Requests);
    }

    /// <summary>Another session's patient, a patient the explorer never made, a missing one, and a wiped one all answer the same 404, and nothing is posted.</summary>
    [Theory]
    [InlineData("other-session")]
    [InlineData("not-created-by-the-explorer")]
    [InlineData("missing")]
    [InlineData("gone")]
    public async Task AddCondition_ShouldAnswer404ForAPatientThatIsNotThisSessions(string which)
    {
        // Arrange
        using var factory = new FhirApiFactory();
        switch (which)
        {
            case "other-session":
                factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created(session: OTHER_SESSION));
                break;
            case "not-created-by-the-explorer":
                factory.Handler.On(HttpMethod.Get, "/Patient/1842", Fixtures.Patient("1842"));
                break;
            case "missing":
                factory.Handler.On(HttpMethod.Get, "/Patient/1842", FakeFhirHandler.Outcome("no such patient"), HttpStatusCode.NotFound);
                break;
            default:
                factory.Handler.On(HttpMethod.Get, "/Patient/1842", FakeFhirHandler.Outcome("gone"), HttpStatusCode.Gone);
                break;
        }

        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.NotFound, "not-found");
        Assert.Contains("This session created no Patient with id '1842'", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Post);
    }

    /// <summary>An add spends the write budget like any other write.</summary>
    [Fact]
    public async Task AddCondition_ShouldSpendTheWriteBudget()
    {
        // Arrange
        using var factory = new FhirApiFactory(new Dictionary<string, string> { ["Fhir:WriteRateLimitBudget"] = "1" });
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.CountOnly(0));
        factory.Handler.On(HttpMethod.Post, "/Condition", Stored(), HttpStatusCode.Created);
        using var client = factory.CreateClient();

        // Act
        var first = await client.SendAsync(AddCondition(), Ct);
        var second = await client.SendAsync(AddCondition(), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var problem = await AssertProblem(second, HttpStatusCode.TooManyRequests, "rate-limited");
        Assert.Contains("1 writes", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
        Assert.NotNull(second.Headers.RetryAfter?.Delta);
    }

    /// <summary>A sandbox that fails the create is a 502 problem, never cached.</summary>
    [Fact]
    public async Task AddCondition_ShouldAnswer502WhenTheSandboxIsDown()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition?", Fixtures.CountOnly(0));
        factory.Handler.OnServerError("/Condition");
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(), Ct);

        // Assert
        await AssertProblem(response, HttpStatusCode.BadGateway, "upstream-unavailable");
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    /// <summary>A sandbox that never answers the guard read runs out the time budget; the add is a 504 and nothing is posted.</summary>
    [Fact]
    public async Task AddCondition_ShouldAnswer504WhenTheSandboxHangs()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.OnHang("/Patient/1842");
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(AddCondition(), Ct);

        // Assert
        await AssertProblem(response, HttpStatusCode.GatewayTimeout, "upstream-timeout");
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Post);
    }

    /// <summary>A caller that gives up mid-flight cancels the upstream call through the token; nothing is posted after the cancellation.</summary>
    [Fact]
    public async Task AddCondition_ShouldStopWhenTheCallerCancels()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        var upstreamCancelled = new TaskCompletionSource();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", async (_, _, ct) =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(10), ct);
            }
            catch (OperationCanceledException)
            {
                upstreamCancelled.TrySetResult();
                throw;
            }

            return FakeFhirHandler.Json(Created());
        });
        using var client = factory.CreateClient();
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));

        // Act
        var act = () => client.SendAsync(AddCondition(), cancellation.Token);

        // Assert
        await Assert.ThrowsAnyAsync<OperationCanceledException>(act);
        await upstreamCancelled.Task.WaitAsync(TimeSpan.FromSeconds(2), Ct);
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Post);
    }

    #endregion

    #region Resolve

    private const string RESOLVE_PATH = "/api/fhir/patients/1842/conditions/9f1c/resolve";

    private static HttpRequestMessage Resolve(string path = RESOLVE_PATH, string? session = SESSION) => Write(HttpMethod.Post, path, session: session);

    /// <summary>The happy path: the guard reads the patient, the condition is read and found to reference it, and one PUT sets it resolved with today's abatement.</summary>
    [Fact]
    public async Task ResolveCondition_ShouldSetTheConditionResolvedAndAnswer204()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition/9f1c", Stored());
        factory.Handler.On(HttpMethod.Put, "/Condition/9f1c", (request, _, ct) => Echo(request, ct));
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Resolve(), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        var put = Assert.Single(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
        Assert.Contains("\"id\":\"9f1c\"", put.Body, StringComparison.Ordinal);
        Assert.Contains("\"code\":\"resolved\"", put.Body, StringComparison.Ordinal);
        Assert.DoesNotContain("\"code\":\"active\"", put.Body, StringComparison.Ordinal);
        Assert.Contains("\"abatementDateTime\":\"" + DateTime.UtcNow.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture), put.Body, StringComparison.Ordinal);
        Assert.Contains("\"code\":\"59621000\"", put.Body, StringComparison.Ordinal);
        Assert.Equal([HttpMethod.Get, HttpMethod.Get, HttpMethod.Put], factory.Handler.Sent.Select(r => r.Method));
    }

    /// <summary>Resolving a resolved condition is the end state already: 204 and no write, so the operation is idempotent.</summary>
    [Fact]
    public async Task ResolveCondition_ShouldAnswer204WithoutWritingWhenAlreadyResolved()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition/9f1c", Stored(status: "resolved"));
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Resolve(), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
    }

    /// <summary>A malformed id in either place is a 400 before any header is read or anything goes upstream.</summary>
    [Theory]
    [InlineData("/api/fhir/patients/not%20an%20id/conditions/9f1c/resolve", "patientId")]
    [InlineData("/api/fhir/patients/1842/conditions/not%20an%20id/resolve", "conditionId")]
    public async Task ResolveCondition_ShouldRejectAMalformedId(string path, string parameter)
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Resolve(path), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.BadRequest, "invalid-parameter");
        Assert.Contains($"'{parameter}'", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
        Assert.Empty(factory.Handler.Requests);
    }

    /// <summary>A missing or malformed session header is a 400 validation problem naming it.</summary>
    [Theory]
    [InlineData(null)]
    [InlineData("not-a-uuid")]
    public async Task ResolveCondition_ShouldRejectABadSessionHeaderWithAValidationProblem(string? session)
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Resolve(session: session), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.BadRequest, "validation-failed");
        Assert.True(problem.GetProperty("errors").TryGetProperty("X-Demo-Session", out _), "expected an error for the session header");
        Assert.Empty(factory.Handler.Requests);
    }

    /// <summary>The seeded patient's conditions are read-only too, and the refusal costs no upstream call.</summary>
    [Fact]
    public async Task ResolveCondition_ShouldAnswer403ForTheSeededPatientWithoutTouchingTheSandbox()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Resolve("/api/fhir/patients/mvc-programmer/conditions/c1/resolve"), Ct);

        // Assert
        await AssertProblem(response, HttpStatusCode.Forbidden, "read-only");
        Assert.Empty(factory.Handler.Requests);
    }

    /// <summary>A patient that is not this session's answers the patient 404 before the condition is read.</summary>
    [Theory]
    [InlineData("other-session")]
    [InlineData("missing")]
    [InlineData("gone")]
    public async Task ResolveCondition_ShouldAnswer404ForAPatientThatIsNotThisSessions(string which)
    {
        // Arrange
        using var factory = new FhirApiFactory();
        switch (which)
        {
            case "other-session":
                factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created(session: OTHER_SESSION));
                break;
            case "missing":
                factory.Handler.On(HttpMethod.Get, "/Patient/1842", FakeFhirHandler.Outcome("no such patient"), HttpStatusCode.NotFound);
                break;
            default:
                factory.Handler.On(HttpMethod.Get, "/Patient/1842", FakeFhirHandler.Outcome("gone"), HttpStatusCode.Gone);
                break;
        }

        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Resolve(), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.NotFound, "not-found");
        Assert.Contains("This session created no Patient with id '1842'", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
        Assert.DoesNotContain(factory.Handler.Requests, u => u.PathAndQuery.Contains("/Condition/", StringComparison.Ordinal));
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
    }

    /// <summary>A condition that is missing, wiped, or on another patient is one and the same 404, and nothing is written.</summary>
    [Theory]
    [InlineData("missing")]
    [InlineData("gone")]
    [InlineData("another-patient")]
    public async Task ResolveCondition_ShouldAnswer404ForAConditionThatIsNotThePatients(string which)
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        switch (which)
        {
            case "missing":
                factory.Handler.On(HttpMethod.Get, "/Condition/9f1c", FakeFhirHandler.Outcome("no such condition"), HttpStatusCode.NotFound);
                break;
            case "gone":
                factory.Handler.On(HttpMethod.Get, "/Condition/9f1c", FakeFhirHandler.Outcome("gone"), HttpStatusCode.Gone);
                break;
            default:
                var other = Stored();
                other.Subject = new ResourceReference("Patient/9999");
                factory.Handler.On(HttpMethod.Get, "/Condition/9f1c", other);
                break;
        }

        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Resolve(), Ct);

        // Assert
        var problem = await AssertProblem(response, HttpStatusCode.NotFound, "not-found");
        Assert.Equal("Condition not found", problem.GetProperty("title").GetString());
        Assert.Contains("Patient '1842' created by this session has no Condition with id '9f1c'", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
    }

    /// <summary>A resolve spends the write budget like any other write.</summary>
    [Fact]
    public async Task ResolveCondition_ShouldSpendTheWriteBudget()
    {
        // Arrange
        using var factory = new FhirApiFactory(new Dictionary<string, string> { ["Fhir:WriteRateLimitBudget"] = "1" });
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition/9f1c", Stored(status: "resolved"));
        using var client = factory.CreateClient();

        // Act
        var first = await client.SendAsync(Resolve(), Ct);
        var second = await client.SendAsync(Resolve(), Ct);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        var problem = await AssertProblem(second, HttpStatusCode.TooManyRequests, "rate-limited");
        Assert.Contains("1 writes", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
    }

    /// <summary>A sandbox that fails the update is a 502 problem, never cached.</summary>
    [Fact]
    public async Task ResolveCondition_ShouldAnswer502WhenTheSandboxIsDown()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.On(HttpMethod.Get, "/Condition/9f1c", Stored());
        factory.Handler.OnServerError("/Condition/9f1c");
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Resolve(), Ct);

        // Assert
        await AssertProblem(response, HttpStatusCode.BadGateway, "upstream-unavailable");
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    /// <summary>A sandbox that never answers the condition read runs out the time budget; 504 and nothing written.</summary>
    [Fact]
    public async Task ResolveCondition_ShouldAnswer504WhenTheSandboxHangs()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        factory.Handler.OnHang("/Condition/9f1c");
        using var client = factory.CreateClient();

        // Act
        var response = await client.SendAsync(Resolve(), Ct);

        // Assert
        await AssertProblem(response, HttpStatusCode.GatewayTimeout, "upstream-timeout");
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
    }

    /// <summary>A caller that gives up mid-flight cancels the upstream call through the token; nothing is written after the cancellation.</summary>
    [Fact]
    public async Task ResolveCondition_ShouldStopWhenTheCallerCancels()
    {
        // Arrange
        using var factory = new FhirApiFactory();
        factory.Handler.On(HttpMethod.Get, "/Patient/1842", Created());
        var upstreamCancelled = new TaskCompletionSource();
        factory.Handler.On(HttpMethod.Get, "/Condition/9f1c", async (_, _, ct) =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(10), ct);
            }
            catch (OperationCanceledException)
            {
                upstreamCancelled.TrySetResult();
                throw;
            }

            return FakeFhirHandler.Json(Stored());
        });
        using var client = factory.CreateClient();
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(80));

        // Act
        var act = () => client.SendAsync(Resolve(), cancellation.Token);

        // Assert
        await Assert.ThrowsAnyAsync<OperationCanceledException>(act);
        await upstreamCancelled.Task.WaitAsync(TimeSpan.FromSeconds(2), Ct);
        Assert.DoesNotContain(factory.Handler.Sent, r => r.Method == HttpMethod.Put);
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
