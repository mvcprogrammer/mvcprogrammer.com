using Experience.Api.Http;
using Experience.Api.Services;

namespace Experience.Api.Endpoints;

public static class SkillEndpoints
{
    public static RouteGroupBuilder MapSkills(this RouteGroupBuilder api)
    {
        api.MapGet("/skills", ListSkills).WithName("listSkills").WithTags("Skills");
        return api;
    }

    private static async Task<IResult> ListSkills(HttpContext context, IExperienceService service, CancellationToken cancellationToken) =>
        CacheableJson.Ok(context, await service.ListSkillsAsync(cancellationToken));
}
