using Microsoft.AspNetCore.Http;

namespace Api.Shared.Http;

/// <summary>RFC 9457 problem responses with the `type` URIs promised in openapi.yaml.</summary>
public static class Problems
{
    private const string TYPE_BASE = "https://mvcprogrammer.com/api/problems/";

    public static IResult NotFound(HttpContext context, string title, string detail) =>
        Results.Problem(
            type: TYPE_BASE + "not-found",
            title: title,
            statusCode: StatusCodes.Status404NotFound,
            detail: detail,
            instance: context.Request.Path);

    public static IResult InvalidParameter(HttpContext context, string detail) =>
        Results.Problem(
            type: TYPE_BASE + "invalid-parameter",
            title: "Invalid parameter",
            statusCode: StatusCodes.Status400BadRequest,
            detail: detail,
            instance: context.Request.Path + context.Request.QueryString);

    public static IResult NotImplemented(HttpContext context) =>
        NotImplemented(context, "Write operations are part of the admin API, which has not shipped yet.");

    /// <summary>501 for an operation the spec promises and the code does not yet keep, with the caller's own wording.</summary>
    public static IResult NotImplemented(HttpContext context, string detail) =>
        Results.Problem(
            type: TYPE_BASE + "not-implemented",
            title: "Not implemented",
            statusCode: StatusCodes.Status501NotImplemented,
            detail: detail,
            instance: context.Request.Path);

    /// <summary>400 in the ValidationProblemDetails shape: one entry per invalid field. Never cached.</summary>
    public static IResult ValidationFailed(HttpContext context, IReadOnlyDictionary<string, string[]> errors)
    {
        ArgumentNullException.ThrowIfNull(errors);
        context.Response.Headers.CacheControl = "no-store";
        return Results.ValidationProblem(
            errors.ToDictionary(e => e.Key, e => e.Value, StringComparer.Ordinal),
            type: TYPE_BASE + "validation-failed",
            title: "Validation failed",
            statusCode: StatusCodes.Status400BadRequest,
            detail: "One or more fields are invalid.",
            instance: context.Request.Path);
    }

    /// <summary>403 for a resource the caller may read but never change.</summary>
    public static IResult ReadOnly(HttpContext context, string title, string detail)
    {
        context.Response.Headers.CacheControl = "no-store";
        return Results.Problem(
            type: TYPE_BASE + "read-only",
            title: title,
            statusCode: StatusCodes.Status403Forbidden,
            detail: detail,
            instance: context.Request.Path);
    }

    /// <summary>409 for a change that cannot be applied to the current state.</summary>
    public static IResult Conflict(HttpContext context, string title, string detail)
    {
        context.Response.Headers.CacheControl = "no-store";
        return Results.Problem(
            type: TYPE_BASE + "conflict",
            title: title,
            statusCode: StatusCodes.Status409Conflict,
            detail: detail,
            instance: context.Request.Path);
    }

    /// <summary>415 for a body in a media type the operation does not take.</summary>
    public static IResult UnsupportedMediaType(HttpContext context, string detail)
    {
        context.Response.Headers.CacheControl = "no-store";
        return Results.Problem(
            type: TYPE_BASE + "unsupported-media-type",
            title: "Unsupported media type",
            statusCode: StatusCodes.Status415UnsupportedMediaType,
            detail: detail,
            instance: context.Request.Path);
    }

    /// <summary>429 with Retry-After. Never cached.</summary>
    public static IResult RateLimited(HttpContext context, string detail, int retryAfterSeconds)
    {
        context.Response.Headers.RetryAfter = retryAfterSeconds.ToString();
        context.Response.Headers.CacheControl = "no-store";
        return Results.Problem(
            type: TYPE_BASE + "rate-limited",
            title: "Too many requests",
            statusCode: StatusCodes.Status429TooManyRequests,
            detail: detail,
            instance: context.Request.Path + context.Request.QueryString);
    }

    /// <summary>502 for an upstream that answered badly or not at all after retries. Never cached.</summary>
    public static IResult UpstreamUnavailable(HttpContext context, string title, string detail)
    {
        context.Response.Headers.CacheControl = "no-store";
        return Results.Problem(
            type: TYPE_BASE + "upstream-unavailable",
            title: title,
            statusCode: StatusCodes.Status502BadGateway,
            detail: detail,
            instance: context.Request.Path);
    }

    /// <summary>504 for an upstream that ran out the overall time budget. Never cached.</summary>
    public static IResult UpstreamTimeout(HttpContext context, string title, string detail)
    {
        context.Response.Headers.CacheControl = "no-store";
        return Results.Problem(
            type: TYPE_BASE + "upstream-timeout",
            title: title,
            statusCode: StatusCodes.Status504GatewayTimeout,
            detail: detail,
            instance: context.Request.Path);
    }
}
