using Api.Shared.Http;
using Experience.Api.Models;
using Experience.Api.Services;

namespace Experience.Api.Endpoints;

public static class ExperienceEndpoints
{
    private const int MAX_SKILL_LENGTH = 60;

    public static RouteGroupBuilder MapExperience(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/experience").WithTags("Experience");

        group.MapGet("/", ListPositions).WithName("listPositions");
        group.MapGet("/{positionId}", GetPosition).WithName("getPosition");

        // Write side, stubbed. Each returns 501 until the admin API lands; the routes, bodies,
        // and names already match openapi.yaml so the contract is settled before the code.
        group.MapPost("/", CreatePosition).WithName("createPosition");
        group.MapPut("/{positionId}", UpdatePosition).WithName("updatePosition");
        group.MapDelete("/{positionId}", DeletePosition).WithName("deletePosition");

        return group;
    }

    private static async Task<IResult> ListPositions(HttpContext context, IExperienceService service, string? skill, CancellationToken cancellationToken)
    {
        if (skill is not null && (skill.Length == 0 || skill.Length > MAX_SKILL_LENGTH))
        {
            return Problems.InvalidParameter(context, $"'skill' must be between 1 and {MAX_SKILL_LENGTH} characters.");
        }

        var list = await service.ListPositionsAsync(skill, cancellationToken);
        return CacheableJson.Ok(context, list);
    }

    private static async Task<IResult> GetPosition(HttpContext context, IExperienceService service, string positionId, CancellationToken cancellationToken)
    {
        var position = await service.GetPositionAsync(positionId, cancellationToken);
        return position is null
            ? Problems.NotFound(context, "Position not found", $"No position with id '{positionId}'.")
            : CacheableJson.Ok(context, position);
    }

    private static IResult CreatePosition(HttpContext context, Position position) =>
        Problems.NotImplemented(context);

    private static IResult UpdatePosition(HttpContext context, string positionId, PositionInput input) =>
        Problems.NotImplemented(context);

    private static IResult DeletePosition(HttpContext context, string positionId) =>
        Problems.NotImplemented(context);
}
