using System.ComponentModel.DataAnnotations;

namespace Hl7.Etl.Configurations;

/// <summary>
/// Everything the ETL needs to know: where the landing database is, where the FHIR server is, and
/// how big a batch is. Bound from the <c>Etl</c> configuration section (environment:
/// <c>Etl__ConnectionString</c> and so on); <c>HL7_ETL_CONNECTION</c> overrides the connection string.
/// </summary>
public sealed class EtlOptions
{
    /// <summary>The configuration section the options bind from.</summary>
    public const string SECTION = "Etl";

    /// <summary>The environment variable that overrides <see cref="ConnectionString"/>.</summary>
    public const string CONNECTION_VARIABLE = "HL7_ETL_CONNECTION";

    /// <summary>Npgsql connection string of the landing database. The default is a local Homebrew Postgres.</summary>
    [Required]
    public string ConnectionString { get; set; } = "Host=localhost;Database=hl7_etl";

    /// <summary>The FHIR R4 base the loader writes to; the same public sandbox the explorer reads.</summary>
    [Required]
    public Uri FhirBaseUrl { get; set; } = new("https://hapi.fhir.org/baseR4");

    /// <summary>The identifier system every resource the ETL writes carries, so the cohort is one search away.</summary>
    [Required]
    public Uri IdentifierSystem { get; set; } = new("https://mvcprogrammer.com/fhir/etl");

    /// <summary>Messages claimed per loader batch; one transaction bundle per batch.</summary>
    [Range(1, 500)]
    public int BatchSize { get; set; } = 25;

    /// <summary>A claim older than this is treated as abandoned by a run that died, and claimed again.</summary>
    public int StaleClaimMinutes { get; set; } = 10;

    /// <summary>Per-attempt timeout of a request to the FHIR server, in milliseconds.</summary>
    [Range(1_000, 120_000)]
    public int AttemptTimeoutMs { get; set; } = 30_000;

    /// <summary>Total budget of one request across retries, in milliseconds.</summary>
    [Range(1_000, 300_000)]
    public int TotalTimeoutMs { get; set; } = 90_000;

    /// <summary>Retries after the first attempt. A transaction bundle of conditional creates is idempotent, so retrying is safe.</summary>
    [Range(0, 5)]
    public int RetryCount { get; set; } = 2;
}
