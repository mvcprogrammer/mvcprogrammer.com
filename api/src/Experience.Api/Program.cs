using Experience.Api.Data;
using Experience.Api.Endpoints;
using Experience.Api.Http;
using Experience.Api.Services;

var builder = WebApplication.CreateSlimBuilder(args);

// On Lambda this swaps Kestrel for the function-URL event loop (HTTP API v2 payload).
// Anywhere else it is a no-op and the app is a normal Kestrel host.
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

builder.Services.ConfigureHttpJsonOptions(options => ApiJson.Apply(options.SerializerOptions));
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = ctx => ctx.ProblemDetails.Instance ??= ctx.HttpContext.Request.Path);

builder.Services.AddExperienceData(builder.Configuration);
builder.Services.AddSingleton<IExperienceService, ExperienceService>();

var app = builder.Build();

// Unhandled exceptions become application/problem+json 500s with no internals in the body.
app.UseExceptionHandler();
// Unmatched routes and other bare status codes become problem+json too.
app.UseStatusCodePages();

// CloudFront forwards /api/* to the function URL with the path intact, so routes carry the prefix.
var api = app.MapGroup("/api");
api.MapHealth();
api.MapExperience();
api.MapSkills();

app.Run();

/// <summary>Exposed so the test project can host the app with WebApplicationFactory.</summary>
public partial class Program;
