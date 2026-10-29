using Portfolio.Blazor.Configurations;
using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Services;

namespace Portfolio.Blazor.Extensions;

/// <summary>Registers the site's services.</summary>
public static class ServiceCollectionExtensions
{
    /// <summary>Adds options, the three HTTP clients, and the contact topic state.</summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Host configuration; the "Site" section is bound to <see cref="SiteOptions"/>.</param>
    /// <param name="baseAddress">The site origin, used as the base address of the Experience and FHIR API clients.</param>
    public static IServiceCollection AddPortfolioServices(this IServiceCollection services, IConfiguration configuration, string baseAddress)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentException.ThrowIfNullOrWhiteSpace(baseAddress);

        services.AddOptions<SiteOptions>()
            .Bind(configuration.GetSection(SiteOptions.SECTION))
            .ValidateDataAnnotations();

        services.AddHttpClient<IExperienceClient, ExperienceClient>(client =>
        {
            client.BaseAddress = new Uri(baseAddress);
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        // The FHIR function's own budget is 22 s under CloudFront's 30 s; the browser waits a little past that.
        services.AddHttpClient<IFhirClient, FhirClient>(client =>
        {
            client.BaseAddress = new Uri(baseAddress);
            client.Timeout = TimeSpan.FromSeconds(32);
        });

        services.AddHttpClient<IContactClient, ContactClient>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(20);
        });

        services.AddSingleton<IContactTopicState, ContactTopicState>();

        return services;
    }
}
