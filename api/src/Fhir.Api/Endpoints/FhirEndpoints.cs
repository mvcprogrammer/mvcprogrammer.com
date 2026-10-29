using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Api.Shared.Http;
using Fhir.Api.Fhir;
using Fhir.Api.Http;
using Fhir.Api.Services;
using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;

namespace Fhir.Api.Endpoints;

/// <summary>HTTP in, HTTP out for /api/fhir. Validates the inputs promised in openapi.yaml and leaves the rest to the service.</summary>
public static partial class FhirEndpoints
{
    /// <summary>Sandbox data can change under the explorer: shared caches hold ten minutes, browsers revalidate after one.</summary>
    public const string CACHE_CONTROL = "public, max-age=60, s-maxage=600";

    /// <summary>The capability subset changes only when the sandbox is upgraded.</summary>
    public const string CAPABILITY_CACHE_CONTROL = "public, max-age=300, s-maxage=3600";

    private const int MAX_FAMILY_LENGTH = 60;
    private const int MAX_IDENTIFIER_LENGTH = 120;

    /// <summary>The detail every stubbed write answers with; the wording openapi.yaml promises.</summary>
    private const string WRITES_NOT_IMPLEMENTED = "Patient writes are specified and arrive with the explorer's next release.";

    /// <summary>Firely's System.Text.Json serializer for R4 POCOs, pretty-printed for the raw-bundle toggle.</summary>
    private static readonly JsonSerializerOptions FHIR_JSON = new JsonSerializerOptions().ForFhir(ModelInfo.ModelInspector).Pretty();

    public static RouteGroupBuilder MapFhir(this RouteGroupBuilder api)
    {
        ArgumentNullException.ThrowIfNull(api);
        var group = api.MapGroup("/fhir").WithTags("FHIR");

        var guarded = group.MapGroup(string.Empty)
            .AddEndpointFilter<RateLimitFilter>()
            .AddEndpointFilter<UpstreamProblemFilter>();
        guarded.MapGet("/patients", SearchPatients).WithName("searchPatients");
        guarded.MapGet("/patients/{patientId}/summary", GetPatientSummary).WithName("getPatientSummary");
        guarded.MapGet("/patients/{patientId}/raw", GetPatientRawBundle).WithName("getPatientRawBundle");
        guarded.MapGet("/capability", GetCapability).WithName("getFhirCapability");

        // Write side, stubbed. Each answers 501 until the write slice lands (#144); the routes and
        // names already match openapi.yaml 1.2.0 so the contract is settled before the code. The
        // bodies are not bound yet, so nothing is validated ahead of the 501.
        group.MapPost("/patients", CreatePatient).WithName("createPatient");
        group.MapPut("/patients/{patientId}", ReplacePatient).WithName("replacePatient");
        group.MapPatch("/patients/{patientId}", PatchPatient).WithName("patchPatient");
        group.MapDelete("/patients/{patientId}", DeletePatient).WithName("deletePatient");

        group.MapGet("/health", GetHealth).WithName("getFhirHealth").WithTags("Operations");
        return group;
    }

    private static async Task<IResult> SearchPatients(
        HttpContext context,
        IPatientExplorerService service,
        string? family,
        string? birthdate,
        string? identifier,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(family) || family.Length > MAX_FAMILY_LENGTH)
        {
            return Problems.InvalidParameter(context, $"'family' is required and must be between 1 and {MAX_FAMILY_LENGTH} characters.");
        }

        if (birthdate is not null && !DateOnly.TryParseExact(birthdate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
        {
            return Problems.InvalidParameter(context, "'birthdate' must be a date in YYYY-MM-DD form.");
        }

        if (identifier is not null && (identifier.Length == 0 || identifier.Length > MAX_IDENTIFIER_LENGTH))
        {
            return Problems.InvalidParameter(context, $"'identifier' must be between 1 and {MAX_IDENTIFIER_LENGTH} characters.");
        }

        var result = await service.SearchAsync(family.Trim(), birthdate, identifier, cancellationToken);
        return CacheableJson.Ok(context, result, CACHE_CONTROL);
    }

    private static async Task<IResult> GetPatientSummary(HttpContext context, IPatientExplorerService service, string patientId, CancellationToken cancellationToken)
    {
        if (!IsFhirId(patientId))
        {
            return Problems.InvalidParameter(context, "'patientId' must be a FHIR id: 1 to 64 letters, digits, hyphens, or dots.");
        }

        var summary = await service.SummaryAsync(patientId, cancellationToken);
        return CacheableJson.Ok(context, summary, CACHE_CONTROL);
    }

    private static async Task<IResult> GetPatientRawBundle(HttpContext context, IPatientExplorerService service, string patientId, CancellationToken cancellationToken)
    {
        if (!IsFhirId(patientId))
        {
            return Problems.InvalidParameter(context, "'patientId' must be a FHIR id: 1 to 64 letters, digits, hyphens, or dots.");
        }

        var bundle = await service.RawAsync(patientId, cancellationToken);
        var body = JsonSerializer.SerializeToUtf8Bytes(bundle, FHIR_JSON);
        return CacheableJson.Bytes(context, body, "application/fhir+json; charset=utf-8", CACHE_CONTROL);
    }

    private static async Task<IResult> GetCapability(HttpContext context, CapabilityCache capability, CancellationToken cancellationToken)
    {
        var subset = await capability.GetAsync(cancellationToken);
        return CacheableJson.Ok(context, subset, CAPABILITY_CACHE_CONTROL);
    }

    private static IResult CreatePatient(HttpContext context) => Problems.NotImplemented(context, WRITES_NOT_IMPLEMENTED);

    private static IResult ReplacePatient(HttpContext context, string patientId) => Problems.NotImplemented(context, WRITES_NOT_IMPLEMENTED);

    private static IResult PatchPatient(HttpContext context, string patientId) => Problems.NotImplemented(context, WRITES_NOT_IMPLEMENTED);

    private static IResult DeletePatient(HttpContext context, string patientId) => Problems.NotImplemented(context, WRITES_NOT_IMPLEMENTED);

    private static IResult GetHealth(HttpContext context, IConfiguration configuration)
    {
        context.Response.Headers.CacheControl = "no-store";
        return Results.Ok(new Models.Health("ok", configuration["API_VERSION"] ?? "0.0.0"));
    }

    private static bool IsFhirId(string id) => FhirIdPattern().IsMatch(id);

    [GeneratedRegex(@"^[A-Za-z0-9\-\.]{1,64}$")]
    private static partial Regex FhirIdPattern();
}
