using Fhir.Api.Fhir;
using Fhir.Api.Tests.Fakes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Fhir.Api.Tests;

/// <summary>
/// The app in-process with the sandbox replaced by <see cref="Handler"/>. Timeouts and the page
/// cap are shortened so the failure paths run in well under a second; the resilience pipeline
/// itself (retry, attempt and total timeout) stays real.
/// </summary>
public sealed class FhirApiFactory : WebApplicationFactory<Program>
{
    private readonly IReadOnlyDictionary<string, string> _overrides;

    public FhirApiFactory() : this(new Dictionary<string, string>())
    {
    }

    public FhirApiFactory(IReadOnlyDictionary<string, string> overrides)
    {
        _overrides = overrides;
    }

    public FakeFhirHandler Handler { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("API_VERSION", "1.1.0-test");
        builder.UseSetting("Fhir:BaseUrl", "https://fhir.test/r4");
        builder.UseSetting("Fhir:SourceName", "Fake sandbox");
        builder.UseSetting("Fhir:AttemptTimeoutMs", "300");
        builder.UseSetting("Fhir:TotalTimeoutMs", "1500");
        builder.UseSetting("Fhir:RetryDelayMs", "10");
        builder.UseSetting("Fhir:PageCap", "2");
        builder.UseSetting("Fhir:MaxVitals", "4");
        foreach (var (key, value) in _overrides)
        {
            builder.UseSetting(key, value);
        }

        builder.ConfigureServices(services =>
            services.AddHttpClient(FhirGateway.CLIENT_NAME).ConfigurePrimaryHttpMessageHandler(() => Handler));
    }
}
