using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;

namespace Api.Shared.Http;

/// <summary>
/// Responses with a strong ETag derived from the body, the Cache-Control promised in
/// openapi.yaml, and 304 handling for If-None-Match. CloudFront caches on these headers, so
/// the function runs only when the cache misses.
/// </summary>
public static class CacheableJson
{
    /// <summary>The Experience API's policy: browsers revalidate after five minutes, shared caches hold an hour.</summary>
    public const string CACHE_CONTROL = "public, max-age=300, s-maxage=3600";

    public static IResult Ok<T>(HttpContext context, T value) => Ok(context, value, CACHE_CONTROL);

    public static IResult Ok<T>(HttpContext context, T value, string cacheControl)
    {
        var body = JsonSerializer.SerializeToUtf8Bytes(value, ApiJson.OPTIONS);
        return Bytes(context, body, "application/json; charset=utf-8", cacheControl);
    }

    /// <summary>An already-serialised body (for example FHIR JSON) with the same ETag and 304 handling.</summary>
    public static IResult Bytes(HttpContext context, byte[] body, string contentType, string cacheControl)
    {
        var etag = new EntityTagHeaderValue('"' + Convert.ToHexStringLower(SHA256.HashData(body))[..16] + '"');

        var headers = context.Response.GetTypedHeaders();
        headers.ETag = etag;
        headers.CacheControl = CacheControlHeaderValue.Parse(cacheControl);

        var ifNoneMatch = context.Request.GetTypedHeaders().IfNoneMatch;
        if (ifNoneMatch.Any(candidate => candidate.Equals(EntityTagHeaderValue.Any) || candidate.Compare(etag, useStrongComparison: true)))
        {
            return Results.StatusCode(StatusCodes.Status304NotModified);
        }

        return Results.Bytes(body, contentType);
    }
}
