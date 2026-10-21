using Portfolio.Blazor.Enumerations;
using Portfolio.Blazor.Models;

namespace Portfolio.Blazor.Tests.Helpers;

/// <summary>Fixture factories shared by the test classes.</summary>
internal static class TestData
{
    /// <summary>A position with sensible defaults; override what the test cares about.</summary>
    public static Position CreatePosition(
        string id = "advancedmd",
        string title = "Senior Software Engineer",
        string organization = "AdvancedMD",
        string startDate = "2023-12",
        string? endDate = "2026-05",
        WorkMode workMode = WorkMode.Remote,
        string location = "Remote",
        IReadOnlyList<string>? highlights = null,
        IReadOnlyList<string>? skills = null) =>
        new(id, title, organization, startDate, endDate, workMode, location, highlights ?? ["Did the work."], skills ?? ["C#"]);

    /// <summary>Two positions, newest first, as the API returns them.</summary>
    public static PositionList CreatePositionList() =>
        new(2, [CreatePosition(), CreatePosition(id: "tops", title: "Software Engineer", organization: "TOPS Software", startDate: "2020-02", endDate: "2022-08", workMode: WorkMode.OnSite, location: "Florida")]);

    /// <summary>A skill list with the given names, each used by one position.</summary>
    public static SkillList CreateSkillList(params string[] names) =>
        new(names.Length, [.. names.Select(n => new Skill(n, 1, ["advancedmd"]))]);

    /// <summary>A FHIR API answer around a body; override the response facts the test cares about.</summary>
    public static FhirResponse<T> CreateFhirResponse<T>(
        T body,
        int status = 200,
        long durationMs = 120,
        string? xCache = "Miss from cloudfront",
        string? etag = "\"abc123\"",
        string? contentType = "application/json; charset=utf-8") =>
        new(body, status, durationMs, xCache, etag, contentType);

    /// <summary>A trace with one upstream request; override what the test cares about.</summary>
    public static Trace CreateTrace(
        IReadOnlyList<UpstreamRequest>? requests = null,
        int totalDurationMs = 110,
        int bundleEntries = 1,
        bool truncated = false) =>
        new(
            new DataSource("HAPI FHIR R4 public test server", "https://hapi.fhir.org/baseR4"),
            requests ?? [new UpstreamRequest("GET", "https://hapi.fhir.org/baseR4/Patient?family=Watsica", 200, 110, 1, 1)],
            totalDurationMs,
            bundleEntries,
            1,
            5,
            truncated,
            "2026-10-21T15:00:00Z");

    /// <summary>One search row with sensible defaults; override what the test cares about.</summary>
    public static PatientListItem CreatePatientListItem(
        string id = "78785",
        string name = "Watsica258, Kimi714",
        string familyName = "Watsica258",
        string? givenName = "Kimi714",
        int? birthYear = 1963,
        Sex? sex = Enumerations.Sex.Female) =>
        new(id, name, familyName, givenName, "1963-03-02", birthYear, sex, null);

    /// <summary>A search result with the given rows (one default row when none), as the API returns it.</summary>
    public static PatientSearchResult CreatePatientSearchResult(params PatientListItem[] items)
    {
        IReadOnlyList<PatientListItem> rows = items.Length == 0 ? [CreatePatientListItem()] : items;
        return new PatientSearchResult(rows.Count, null, new SearchQuery("Watsica", null, null), rows, CreateTrace());
    }

    /// <summary>A search result with no rows, as a wiped sandbox returns.</summary>
    public static PatientSearchResult CreateEmptyPatientSearchResult() =>
        new(0, null, new SearchQuery("Watsica", null, null), [], CreateTrace(requests: [], bundleEntries: 0));

    /// <summary>A patient summary with one active condition, one resolved condition, and two vitals; override what the test cares about.</summary>
    public static PatientSummary CreatePatientSummary(
        PatientDemographics? patient = null,
        Conditions? conditions = null,
        IReadOnlyList<VitalSign>? vitals = null) =>
        new(
            patient ?? new PatientDemographics("78785", "Watsica258, Kimi714", "Watsica258", "Kimi714", "KW", Enumerations.Sex.Female, "1963-03-02", 63, "eed8a921", [new Identifier("http://hospital.example/mrn", "eed8a921", "MR")]),
            new ResourceCounts(2, 31, 240),
            conditions ?? new Conditions(
                [new ConditionItem("Essential hypertension (disorder)", "59621000", "http://snomed.info/sct", "SNOMED CT", ClinicalStatus.Active, "2010-05-01", null)],
                [new ConditionItem("Acute bronchitis (disorder)", "10509002", null, "SNOMED CT", ClinicalStatus.Resolved, null, null)]),
            vitals ??
            [
                new VitalSign("2026-03-31T10:47:00Z", "Blood pressure", "85354-9", null, null, [new VitalComponent("Systolic", "8480-6", 108, "mm[Hg]"), new VitalComponent("Diastolic", "8462-4", 82, "mm[Hg]")]),
                new VitalSign("2026-03-31", "Body weight", "29463-7", 64.6, "kg", null),
            ],
            CreateTrace(
                requests:
                [
                    new UpstreamRequest("GET", "https://hapi.fhir.org/baseR4/Patient/78785", 200, 105, 1, 1),
                    new UpstreamRequest("GET", "https://hapi.fhir.org/baseR4/Condition?patient=78785", 200, 411, 2, 1),
                ],
                totalDurationMs: 580,
                bundleEntries: 3));

    /// <summary>A capability answer in which everything the explorer needs is supported; override what the test cares about.</summary>
    public static CapabilitySubset CreateCapabilitySubset(
        bool ok = true,
        string baseUrl = "https://hapi.fhir.org/baseR4",
        Software? software = null,
        IReadOnlyList<ResourceSupport>? resources = null) =>
        new(
            ok,
            "4.0.1",
            software ?? new Software("HAPI FHIR Server", "8.1.0"),
            baseUrl,
            "2026-10-21T15:00:00Z",
            resources ??
            [
                new ResourceSupport("Patient", true, [new ParamSupport("family", true)]),
                new ResourceSupport("Condition", true, [new ParamSupport("patient", true)]),
                new ResourceSupport("Observation", true, [new ParamSupport("patient", true)]),
                new ResourceSupport("Encounter", true, [new ParamSupport("patient", true)]),
            ]);
}
