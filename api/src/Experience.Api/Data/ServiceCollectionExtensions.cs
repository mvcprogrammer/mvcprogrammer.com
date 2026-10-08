using Amazon.DynamoDBv2;

namespace Experience.Api.Data;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Picks the store: DynamoDB when TABLE_NAME is set (Lambda), otherwise the JSON seed file
    /// (local runs, tests). The choice is made once at startup and logged.
    /// </summary>
    public static IServiceCollection AddExperienceData(this IServiceCollection services, IConfiguration configuration)
    {
        var tableName = configuration["TABLE_NAME"];
        if (!string.IsNullOrWhiteSpace(tableName))
        {
            services.AddSingleton<IAmazonDynamoDB>(_ => new AmazonDynamoDBClient());
            services.AddSingleton<IExperienceRepository>(sp =>
                new DynamoDbExperienceRepository(sp.GetRequiredService<IAmazonDynamoDB>(), tableName));
            return services;
        }

        var seedPath = configuration["EXPERIENCE_SEED_PATH"] ?? JsonFileExperienceRepository.Locate()
            ?? throw new InvalidOperationException(
                "Set TABLE_NAME for DynamoDB, or EXPERIENCE_SEED_PATH to a positions.json file. " +
                "Neither was set and no seed/positions.json was found above the application directory.");

        services.AddSingleton<IExperienceRepository>(new JsonFileExperienceRepository(seedPath));
        return services;
    }
}
