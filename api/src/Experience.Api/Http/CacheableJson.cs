using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Net.Http.Headers;

namespace Experience.Api.Http;

/// <summary>
/// JSON responses with a strong ETag derived from the body, the Cache-Control promised in
/// openapi.yaml, and 304 handling for If-None-Match. CloudFront caches on these headers, so
/// the Lambda runs only when the cache misses.
/// </summary>
public static class CacheableJson
{
    public const string CacheControl = "public, max-age=300, s-maxage=3600";

    public static IResult Ok<T>(HttpContext context, T value)
    {
        var body = JsonSerializer.SerializeToUtf8Bytes(value, ApiJson.Options);
        var etag = new EntityTagHeaderValue('"' + Convert.ToHexStringLower(SHA256.HashData(body))[..16] + '"');

        var headers = context.Response.GetTypedHeaders();
        headers.ETag = etag;
        headers.CacheControl = CacheControlHeaderValue.Parse(CacheControl);

        var ifNoneMatch = context.Request.GetTypedHeaders().IfNoneMatch;
        if (ifNoneMatch.Any(candidate => candidate.Equals(EntityTagHeaderValue.Any) || candidate.Compare(etag, useStrongComparison: true)))
        {
            return Results.StatusCode(StatusCodes.Status304NotModified);
        }

        return Results.Bytes(body, "application/json; charset=utf-8");
    }
}
