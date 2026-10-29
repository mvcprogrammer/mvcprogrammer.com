namespace Fhir.Api.Configuration;

/// <summary>
/// Everything the explorer needs to know about the sandbox and its own limits. Bound from the
/// <c>Fhir</c> configuration section (environment: <c>Fhir__BaseUrl</c> and so on); the two
/// values the SAM template sets, <c>FHIR_BASE_URL</c> and <c>FHIR_SOURCE_NAME</c>, override it.
/// </summary>
public sealed class FhirOptions
{
    public const string SECTION = "Fhir";

    /// <summary>The FHIR R4 base, HAPI by default. SMART Health IT (https://r4.smarthealthit.org) is the documented fallback.</summary>
    public Uri BaseUrl { get; set; } = new("https://hapi.fhir.org/baseR4");

    /// <summary>Shown in the trace's data source.</summary>
    public string SourceName { get; set; } = "HAPI FHIR R4 public test server";

    /// <summary>Pages followed through link[rel=next] per search, including the first. Matches Trace.pageCap in openapi.yaml.</summary>
    public int PageCap { get; set; } = 5;

    /// <summary>_count for the patient search; one page only.</summary>
    public int SearchPageSize { get; set; } = 20;

    /// <summary>_count for the condition search.</summary>
    public int ConditionPageSize { get; set; } = 200;

    /// <summary>_count for the vital-signs search.</summary>
    public int VitalsPageSize { get; set; } = 100;

    /// <summary>Vital signs kept in a summary, newest first.</summary>
    public int MaxVitals { get; set; } = 25;

    /// <summary>Per-attempt upstream timeout.</summary>
    public int AttemptTimeoutMs { get; set; } = 6_000;

    /// <summary>Budget for one upstream request across attempts. The Lambda timeout (25 s) sits above it, under CloudFront's 30 s.</summary>
    public int TotalTimeoutMs { get; set; } = 22_000;

    /// <summary>Retries after the first attempt, with exponential backoff and jitter.</summary>
    public int RetryCount { get; set; } = 2;

    /// <summary>Base delay of the backoff.</summary>
    public int RetryDelayMs { get; set; } = 300;

    /// <summary>Requests one IP may make per window, per warm instance.</summary>
    public int RateLimitBudget { get; set; } = 60;

    /// <summary>The rate-limit window.</summary>
    public int RateLimitWindowSeconds { get; set; } = 600;

    /// <summary>How long a read CapabilityStatement is kept per instance.</summary>
    public int CapabilityTtlSeconds { get; set; } = 3_600;

    public TimeSpan AttemptTimeout => TimeSpan.FromMilliseconds(AttemptTimeoutMs);
    public TimeSpan TotalTimeout => TimeSpan.FromMilliseconds(TotalTimeoutMs);
    public TimeSpan RetryDelay => TimeSpan.FromMilliseconds(RetryDelayMs);
    public TimeSpan RateLimitWindow => TimeSpan.FromSeconds(RateLimitWindowSeconds);
    public TimeSpan CapabilityTtl => TimeSpan.FromSeconds(CapabilityTtlSeconds);
}
