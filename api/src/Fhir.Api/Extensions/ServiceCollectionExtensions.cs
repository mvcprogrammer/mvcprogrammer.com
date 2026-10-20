using Fhir.Api.Configuration;
using Fhir.Api.Fhir;
using Fhir.Api.Http;
using Fhir.Api.Services;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;

namespace Fhir.Api.Extensions;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Options from the Fhir section with the two SAM-set variables on top, the resilient upstream
    /// client, the gateway, the capability cache, the rate limiter, and the service. Everything is
    /// a singleton: the function holds no per-request state beyond what a call creates.
    /// </summary>
    public static IServiceCollection AddFhirExplorer(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddOptions<FhirOptions>()
            .Bind(configuration.GetSection(FhirOptions.SectionName))
            .Configure(options =>
            {
                if (Uri.TryCreate(configuration["FHIR_BASE_URL"], UriKind.Absolute, out var baseUrl))
                {
                    options.BaseUrl = baseUrl;
                }

                if (!string.IsNullOrWhiteSpace(configuration["FHIR_SOURCE_NAME"]))
                {
                    options.SourceName = configuration["FHIR_SOURCE_NAME"]!;
                }
            })
            .Validate(o => o.BaseUrl.IsAbsoluteUri && o.BaseUrl.Scheme is "https" or "http", "Fhir:BaseUrl must be an absolute http(s) URL.")
            .Validate(o => o.AttemptTimeoutMs > 0 && o.TotalTimeoutMs > o.AttemptTimeoutMs, "Fhir:TotalTimeoutMs must exceed Fhir:AttemptTimeoutMs.")
            .Validate(o => o.PageCap >= 1 && o.RateLimitBudget >= 1 && o.RateLimitWindowSeconds >= 1, "Fhir limits must be positive.")
            .ValidateOnStart();

        services.TryAddSingleton(TimeProvider.System);

        services.AddHttpClient(FhirGateway.CLIENT_NAME, (sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<FhirOptions>>().Value;
                client.BaseAddress = options.BaseUrl;
                client.DefaultRequestHeaders.UserAgent.ParseAdd("mvcprogrammer.com-fhir-explorer/1.0 (+https://mvcprogrammer.com/fhir)");
            })
            .AddStandardResilienceHandler()
            .Configure((resilience, sp) =>
            {
                var options = sp.GetRequiredService<IOptions<FhirOptions>>().Value;
                resilience.AttemptTimeout.Timeout = options.AttemptTimeout;
                resilience.TotalRequestTimeout.Timeout = options.TotalTimeout;
                resilience.Retry.MaxRetryAttempts = options.RetryCount;
                resilience.Retry.Delay = options.RetryDelay;
                resilience.Retry.BackoffType = Polly.DelayBackoffType.Exponential;
                resilience.Retry.UseJitter = true;
                // The breaker samples over at least twice the attempt timeout, which the defaults
                // (30 s) satisfy for the production 6 s; tests shorten both together.
                resilience.CircuitBreaker.SamplingDuration = TimeSpan.FromMilliseconds(Math.Max(options.AttemptTimeoutMs * 2, 500));
            });

        services.AddSingleton<IFhirGateway, FhirGateway>();
        services.AddSingleton<CapabilityCache>();
        services.AddSingleton<RateLimiter>();
        services.AddSingleton<IPatientExplorerService, PatientExplorerService>();
        return services;
    }

    private static void TryAddSingleton(this IServiceCollection services, TimeProvider timeProvider)
    {
        if (services.All(d => d.ServiceType != typeof(TimeProvider)))
        {
            services.AddSingleton(timeProvider);
        }
    }
}
