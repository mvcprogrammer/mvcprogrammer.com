using Hl7.Etl.Configurations;
using Hl7.Etl.Databases;
using Hl7.Etl.Interfaces;
using Hl7.Etl.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Npgsql;

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
        services.TryAddSingleton(TimeProvider.System);
        return services;
    }
}
