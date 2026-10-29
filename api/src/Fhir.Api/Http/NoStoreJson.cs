using System.Text.Json;
using Api.Shared.Http;

namespace Fhir.Api.Http;

/// <summary>A write's answer: JSON with Cache-Control no-store, never an ETag, optionally a Location.</summary>
public static class NoStoreJson
{
    public const string CACHE_CONTROL = "no-store";

    public static IResult Json<T>(HttpContext context, T value, int statusCode, string? location = null)
    {
        ArgumentNullException.ThrowIfNull(context);
        context.Response.Headers.CacheControl = CACHE_CONTROL;
        if (location is not null)
        {
            context.Response.Headers.Location = location;
        }

        context.Response.StatusCode = statusCode;
        var body = JsonSerializer.SerializeToUtf8Bytes(value, ApiJson.OPTIONS);
        return Results.Bytes(body, "application/json; charset=utf-8");
    }

    public static IResult NoContent(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        context.Response.Headers.CacheControl = CACHE_CONTROL;
        return Results.NoContent();
    }
}
