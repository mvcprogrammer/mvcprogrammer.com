using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Portfolio.Blazor.Configurations;
using Portfolio.Blazor.Extensions;
using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Services;

namespace Portfolio.Blazor.Tests.Extensions;

/// <summary>Tests for <see cref="ServiceCollectionExtensions.AddPortfolioServices"/>.</summary>
public sealed class ServiceCollectionExtensionsTests
{
    #region AddPortfolioServices Tests

    /// <summary>Every interface resolves to its implementation, and the topic state is a single instance.</summary>
    [Fact]
    public void AddPortfolioServices_ShouldRegisterClientsAndState()
    {
        // Arrange
        var services = new ServiceCollection().AddPortfolioServices(CreateConfiguration(), "https://site.example.test/");

        // Act
        using var provider = services.BuildServiceProvider();

        // Assert
        Assert.IsType<ExperienceClient>(provider.GetRequiredService<IExperienceClient>());
        Assert.IsType<ContactClient>(provider.GetRequiredService<IContactClient>());
        var state = provider.GetRequiredService<IContactTopicState>();
        Assert.IsType<ContactTopicState>(state);
        Assert.Same(state, provider.GetRequiredService<IContactTopicState>());
    }

    /// <summary>The "Site" section binds to the options.</summary>
    [Fact]
    public void AddPortfolioServices_ShouldBindSiteOptions()
    {
        // Arrange
        var services = new ServiceCollection().AddPortfolioServices(CreateConfiguration(), "https://site.example.test/");
        using var provider = services.BuildServiceProvider();

        // Act
        var options = provider.GetRequiredService<IOptions<SiteOptions>>().Value;

        // Assert
        Assert.Equal("https://contact.example.test/", options.ContactEndpoint);
        Assert.Equal("api", options.ExperienceApiBase);
        Assert.Equal("https://kiosk.example.test/", options.KioskUrl);
        Assert.Equal("https://resume.example.test/", options.ResumeUrl);
    }

    /// <summary>Missing or malformed settings fail on first use with a validation error, not a null reference later.</summary>
    [Fact]
    public void AddPortfolioServices_ShouldValidateSiteOptions()
    {
        // Arrange
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Site:ContactEndpoint"] = "not a url" })
            .Build();
        var services = new ServiceCollection().AddPortfolioServices(configuration, "https://site.example.test/");
        using var provider = services.BuildServiceProvider();

        // Act
        var exception = Assert.Throws<OptionsValidationException>(() => provider.GetRequiredService<IOptions<SiteOptions>>().Value);

        // Assert
        Assert.Contains(exception.Failures, f => f.Contains(nameof(SiteOptions.ContactEndpoint), StringComparison.Ordinal));
        Assert.Contains(exception.Failures, f => f.Contains(nameof(SiteOptions.KioskUrl), StringComparison.Ordinal));
    }

    /// <summary>Arguments are guarded.</summary>
    [Fact]
    public void AddPortfolioServices_ShouldThrowOnBadArguments()
    {
        // Arrange
        var services = new ServiceCollection();
        var configuration = CreateConfiguration();

        // Act and Assert
        Assert.Throws<ArgumentNullException>(() => ServiceCollectionExtensions.AddPortfolioServices(null!, configuration, "https://site.example.test/"));
        Assert.Throws<ArgumentNullException>(() => services.AddPortfolioServices(null!, "https://site.example.test/"));
        Assert.Throws<ArgumentException>(() => services.AddPortfolioServices(configuration, " "));
    }

    #endregion

    #region Helper Methods

    private static IConfiguration CreateConfiguration() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Site:ContactEndpoint"] = "https://contact.example.test/",
                ["Site:ExperienceApiBase"] = "api",
                ["Site:ExperienceSeedPath"] = "data/positions.json",
                ["Site:KioskUrl"] = "https://kiosk.example.test/",
                ["Site:ResumeUrl"] = "https://resume.example.test/",
            })
            .Build();

    #endregion
}
