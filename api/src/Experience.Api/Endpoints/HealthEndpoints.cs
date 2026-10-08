using Experience.Api.Models;

namespace Experience.Api.Endpoints;

public static class HealthEndpoints
{
    public static RouteGroupBuilder MapHealth(this RouteGroupBuilder api)
    {
        api.MapGet("/health", GetHealth).WithName("getHealth").WithTags("Operations");
        return api;
    }

    private static IResult GetHealth(HttpContext context, IConfiguration configuration)
    {
        context.Response.Headers.CacheControl = "no-store";
        return Results.Ok(new Health("ok", configuration["API_VERSION"] ?? "0.0.0"));
    }
}
