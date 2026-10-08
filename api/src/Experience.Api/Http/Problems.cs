namespace Experience.Api.Http;

/// <summary>RFC 9457 problem responses with the `type` URIs promised in openapi.yaml.</summary>
public static class Problems
{
    private const string TypeBase = "https://mvcprogrammer.com/api/problems/";

    public static IResult NotFound(HttpContext context, string detail) =>
        Results.Problem(
            type: TypeBase + "not-found",
            title: "Position not found",
            statusCode: StatusCodes.Status404NotFound,
            detail: detail,
            instance: context.Request.Path);

    public static IResult InvalidParameter(HttpContext context, string detail) =>
        Results.Problem(
            type: TypeBase + "invalid-parameter",
            title: "Invalid parameter",
            statusCode: StatusCodes.Status400BadRequest,
            detail: detail,
            instance: context.Request.Path + context.Request.QueryString);

    public static IResult NotImplemented(HttpContext context) =>
        Results.Problem(
            type: TypeBase + "not-implemented",
            title: "Not implemented",
            statusCode: StatusCodes.Status501NotImplemented,
            detail: "Write operations are part of the admin API, which has not shipped yet.",
            instance: context.Request.Path);
}
