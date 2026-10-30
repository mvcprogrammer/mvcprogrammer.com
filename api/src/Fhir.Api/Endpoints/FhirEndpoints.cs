using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Api.Shared.Http;
using Fhir.Api.Fhir;
using Fhir.Api.Http;
using Fhir.Api.Mapping;
using Fhir.Api.Models;
using Fhir.Api.Services;
using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;

namespace Fhir.Api.Endpoints;

/// <summary>HTTP in, HTTP out for /api/fhir. Validates the inputs promised in openapi.yaml (parameters, headers, body shape) and leaves the rest to the two services.</summary>
public static partial class FhirEndpoints
{
    /// <summary>Sandbox data can change under the explorer: shared caches hold ten minutes, browsers revalidate after one.</summary>
    public const string CACHE_CONTROL = "public, max-age=60, s-maxage=600";

    /// <summary>The capability subset changes only when the sandbox is upgraded.</summary>
    public const string CAPABILITY_CACHE_CONTROL = "public, max-age=300, s-maxage=3600";

    private const int MAX_FAMILY_LENGTH = 60;
    private const int MAX_IDENTIFIER_LENGTH = 120;

    /// <summary>The header carrying the visitor's session token on every write.</summary>
    public const string SESSION_HEADER = "X-Demo-Session";

    /// <summary>The header carrying the key a create is made idempotent on.</summary>
    public const string IDEMPOTENCY_HEADER = "Idempotency-Key";

    private const string JSON_PATCH_MEDIA_TYPE = "application/json-patch+json";

    /// <summary>Firely's System.Text.Json serializer for R4 POCOs, pretty-printed for the raw-bundle toggle.</summary>
    private static readonly JsonSerializerOptions _fhirJson = new JsonSerializerOptions().ForFhir(ModelInfo.ModelInspector).Pretty();

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

        // Writes: their own budget on top of the read one, then the write problems, then the upstream ones.
        var writes = group.MapGroup(string.Empty)
            .AddEndpointFilter<RateLimitFilter>()
            .AddEndpointFilter<WriteRateLimitFilter>()
            .AddEndpointFilter<UpstreamProblemFilter>()
            .AddEndpointFilter<WriteProblemFilter>();
        writes.MapPost("/patients", CreatePatient).WithName("createPatient");
        writes.MapPut("/patients/{patientId}", ReplacePatient).WithName("replacePatient");
        writes.MapPatch("/patients/{patientId}", PatchPatient).WithName("patchPatient");
        writes.MapDelete("/patients/{patientId}", DeletePatient).WithName("deletePatient");
        writes.MapPost("/patients/{patientId}/conditions", AddCondition).WithName("addCondition");
        // The one action-shaped route; openapi.yaml records why a POST to a sub-resource was chosen over PATCH, PUT, and DELETE.
        writes.MapPost("/patients/{patientId}/conditions/{conditionId}/resolve", ResolveCondition).WithName("resolveCondition");

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
        var body = JsonSerializer.SerializeToUtf8Bytes(bundle, _fhirJson);
        return CacheableJson.Bytes(context, body, "application/fhir+json; charset=utf-8", CACHE_CONTROL);
    }

    private static async Task<IResult> GetCapability(HttpContext context, CapabilityCache capability, CancellationToken cancellationToken)
    {
        var subset = await capability.GetAsync(cancellationToken);
        return CacheableJson.Ok(context, subset, CAPABILITY_CACHE_CONTROL);
    }

    private static async Task<IResult> CreatePatient(HttpContext context, IPatientWriteService service, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var session = Token(context, SESSION_HEADER, errors);
        var key = Token(context, IDEMPOTENCY_HEADER, errors);
        var input = await ReadBodyAsync<PatientInput>(context, errors, cancellationToken);
        if (errors.Count > 0 || session is null || key is null || input is null)
        {
            return Problems.ValidationFailed(context, errors);
        }

        var (result, created) = await service.CreateAsync(input, session, key, cancellationToken);
        var location = $"/api/fhir/patients/{Uri.EscapeDataString(result.Patient.Id)}/summary";
        return NoStoreJson.Json(context, result, created ? StatusCodes.Status201Created : StatusCodes.Status200OK, location);
    }

    private static async Task<IResult> ReplacePatient(HttpContext context, IPatientWriteService service, string patientId, CancellationToken cancellationToken)
    {
        if (!IsFhirId(patientId))
        {
            return Problems.InvalidParameter(context, "'patientId' must be a FHIR id: 1 to 64 letters, digits, hyphens, or dots.");
        }

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var session = Token(context, SESSION_HEADER, errors);
        var input = await ReadBodyAsync<PatientInput>(context, errors, cancellationToken);
        if (errors.Count > 0 || session is null || input is null)
        {
            return Problems.ValidationFailed(context, errors);
        }

        var result = await service.ReplaceAsync(patientId, input, session, cancellationToken);
        return NoStoreJson.Json(context, result, StatusCodes.Status200OK);
    }

    private static async Task<IResult> PatchPatient(HttpContext context, IPatientWriteService service, string patientId, CancellationToken cancellationToken)
    {
        if (!IsFhirId(patientId))
        {
            return Problems.InvalidParameter(context, "'patientId' must be a FHIR id: 1 to 64 letters, digits, hyphens, or dots.");
        }

        if (!IsMediaType(context, JSON_PATCH_MEDIA_TYPE))
        {
            return Problems.UnsupportedMediaType(context, $"Send the patch as {JSON_PATCH_MEDIA_TYPE}.");
        }

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var session = Token(context, SESSION_HEADER, errors);
        var operations = await ReadBodyAsync<List<PatientPatchOperation>>(context, errors, cancellationToken, requireMediaType: false);
        if (operations is { Count: 0 or > PatientPatchApplier.MAX_OPERATIONS })
        {
            errors["body"] = [$"A patch has between 1 and {PatientPatchApplier.MAX_OPERATIONS} operations."];
        }

        if (errors.Count > 0 || session is null || operations is null)
        {
            return Problems.ValidationFailed(context, errors);
        }

        var result = await service.PatchAsync(patientId, operations, session, cancellationToken);
        return NoStoreJson.Json(context, result, StatusCodes.Status200OK);
    }

    private static async Task<IResult> DeletePatient(HttpContext context, IPatientWriteService service, string patientId, CancellationToken cancellationToken)
    {
        if (!IsFhirId(patientId))
        {
            return Problems.InvalidParameter(context, "'patientId' must be a FHIR id: 1 to 64 letters, digits, hyphens, or dots.");
        }

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var session = Token(context, SESSION_HEADER, errors);
        if (session is null)
        {
            return Problems.ValidationFailed(context, errors);
        }

        await service.DeleteAsync(patientId, session, cancellationToken);
        return NoStoreJson.NoContent(context);
    }

    private static async Task<IResult> AddCondition(HttpContext context, IConditionWriteService service, string patientId, CancellationToken cancellationToken)
    {
        if (!IsFhirId(patientId))
        {
            return Problems.InvalidParameter(context, "'patientId' must be a FHIR id: 1 to 64 letters, digits, hyphens, or dots.");
        }

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var session = Token(context, SESSION_HEADER, errors);
        var input = await ReadBodyAsync<ConditionInput>(context, errors, cancellationToken);
        if (input is not null && (input.Code is null || !SnomedCodePattern().IsMatch(input.Code)))
        {
            errors["code"] = ["'code' is required and must be a SNOMED CT concept id: 6 to 18 digits."];
        }

        if (errors.Count > 0 || session is null || input is null)
        {
            return Problems.ValidationFailed(context, errors);
        }

        var (result, created) = await service.AddAsync(patientId, input, session, cancellationToken);
        var location = $"/api/fhir/patients/{Uri.EscapeDataString(patientId)}/summary";
        return NoStoreJson.Json(context, result, created ? StatusCodes.Status201Created : StatusCodes.Status200OK, location);
    }

    private static async Task<IResult> ResolveCondition(HttpContext context, IConditionWriteService service, string patientId, string conditionId, CancellationToken cancellationToken)
    {
        if (!IsFhirId(patientId))
        {
            return Problems.InvalidParameter(context, "'patientId' must be a FHIR id: 1 to 64 letters, digits, hyphens, or dots.");
        }

        if (!IsFhirId(conditionId))
        {
            return Problems.InvalidParameter(context, "'conditionId' must be a FHIR id: 1 to 64 letters, digits, hyphens, or dots.");
        }

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var session = Token(context, SESSION_HEADER, errors);
        if (session is null)
        {
            return Problems.ValidationFailed(context, errors);
        }

        await service.ResolveAsync(patientId, conditionId, session, cancellationToken);
        return NoStoreJson.NoContent(context);
    }

    /// <summary>A UUID header, lower-cased, or null with an error recorded under the header's name.</summary>
    private static string? Token(HttpContext context, string header, Dictionary<string, string[]> errors)
    {
        var value = context.Request.Headers[header].FirstOrDefault()?.Trim().ToLowerInvariant();
        if (value is not null && DemoTokenPattern().IsMatch(value))
        {
            return value;
        }

        errors[header] = [$"'{header}' is required and must be a UUID."];
        return null;
    }

    /// <summary>The JSON body as <typeparamref name="T"/>, or null with the problem recorded under "body".</summary>
    private static async Task<T?> ReadBodyAsync<T>(HttpContext context, Dictionary<string, string[]> errors, CancellationToken cancellationToken, bool requireMediaType = true)
        where T : class
    {
        if (requireMediaType && !IsMediaType(context, "application/json"))
        {
            errors["body"] = ["Send the body as application/json."];
            return null;
        }

        try
        {
            var value = await JsonSerializer.DeserializeAsync<T>(context.Request.Body, ApiJson.Options, cancellationToken);
            if (value is null)
            {
                errors["body"] = ["A JSON body is required."];
            }

            return value;
        }
        catch (JsonException ex)
        {
            errors["body"] = [$"The body is not valid JSON for this operation: {ex.Message}"];
            return null;
        }
    }

    private static bool IsMediaType(HttpContext context, string mediaType) =>
        context.Request.ContentType is { } contentType
        && contentType.Split(';', 2)[0].Trim().Equals(mediaType, StringComparison.OrdinalIgnoreCase);

    private static IResult GetHealth(HttpContext context, IConfiguration configuration)
    {
        context.Response.Headers.CacheControl = "no-store";
        return Results.Ok(new Health("ok", configuration["API_VERSION"] ?? "0.0.0"));
    }

    private static bool IsFhirId(string id) => FhirIdPattern().IsMatch(id);

    [GeneratedRegex(@"^[A-Za-z0-9\-\.]{1,64}$")]
    private static partial Regex FhirIdPattern();

    [GeneratedRegex(@"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")]
    private static partial Regex DemoTokenPattern();

    /// <summary>The shape of a SNOMED CT concept id, as ConditionInput.code in openapi.yaml constrains it. Membership of the pick list is the service's call.</summary>
    [GeneratedRegex(@"^[0-9]{6,18}$")]
    private static partial Regex SnomedCodePattern();
}
