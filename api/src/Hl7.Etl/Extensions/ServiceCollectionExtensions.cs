using Hl7.Etl.Configurations;
using Hl7.Etl.Databases;
using Hl7.Etl.Interfaces;
using Hl7.Etl.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;
using Npgsql;
using Polly;

namespace Hl7.Etl.Extensions;

/// <summary>Registers the ETL's services: options, the one Npgsql data source, the repository, and the commands.</summary>
public static class ServiceCollectionExtensions
{
    /// <summary>Adds everything the commands need.</summary>
    public static IServiceCollection AddEtlServices(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddOptions<EtlOptions>()
            .Bind(configuration.GetSection(EtlOptions.SECTION))
            .PostConfigure(options =>
            {
                var connection = Environment.GetEnvironmentVariable(EtlOptions.CONNECTION_VARIABLE);
                if (!string.IsNullOrWhiteSpace(connection))
                {
                    options.ConnectionString = connection;
                }
            })
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton(sp => NpgsqlDataSource.Create(sp.GetRequiredService<IOptions<EtlOptions>>().Value.ConnectionString));
        services.AddSingleton<IMessageRepository, MessageRepository>();
        services.AddSingleton<MigrationService>();
        services.AddSingleton<GenerateService>();
        services.AddSingleton<LoadService>();
        services.AddSingleton<IBundleClient, HttpBundleClient>();
        services.TryAddSingleton(TimeProvider.System);

        // Every post is a transaction of conditional creates, so a retry after a timeout cannot duplicate anything.
        services.AddHttpClient(HttpBundleClient.CLIENT_NAME, (sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<EtlOptions>>().Value;
                client.BaseAddress = HttpBundleClient.BaseAddressOf(options.FhirBaseUrl);
                client.DefaultRequestHeaders.UserAgent.ParseAdd("mvcprogrammer.com-hl7-etl/1.0 (+https://mvcprogrammer.com)");
            })
            .AddStandardResilienceHandler()
            .Configure((resilience, sp) =>
            {
                var options = sp.GetRequiredService<IOptions<EtlOptions>>().Value;
                resilience.AttemptTimeout.Timeout = TimeSpan.FromMilliseconds(options.AttemptTimeoutMs);
                resilience.TotalRequestTimeout.Timeout = TimeSpan.FromMilliseconds(options.TotalTimeoutMs);
                resilience.Retry.MaxRetryAttempts = options.RetryCount;
                resilience.Retry.BackoffType = DelayBackoffType.Exponential;
                resilience.Retry.UseJitter = true;
                // The circuit breaker's sampling window must exceed the attempt timeout; a run posts a few bundles, so the breaker hardly matters.
                resilience.CircuitBreaker.SamplingDuration = TimeSpan.FromMilliseconds(options.AttemptTimeoutMs * 2);
            });
        return services;
    }
}
