using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Portfolio.Blazor.Configurations;
using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Services;
using Portfolio.Blazor.Tests.Fakes;

namespace Portfolio.Blazor.Tests.Helpers;

/// <summary>Registrations and JS interop setups the component tests share.</summary>
internal static class BunitContextExtensions
{
    /// <summary>The site options every component test runs with.</summary>
    public static SiteOptions CreateSiteOptions() => new()
    {
        ContactEndpoint = "https://contact.example.test/",
        ExperienceApiBase = "api",
        ExperienceSeedPath = "data/positions.json",
        FhirApiBase = "api/fhir",
        KioskUrl = "https://kiosk.example.test/",
        ResumeUrl = "https://resume.example.test/",
    };

    /// <summary>Registers <see cref="IOptions{SiteOptions}"/> with <see cref="CreateSiteOptions"/>.</summary>
    public static BunitContext AddSiteOptions(this BunitContext context)
    {
        context.Services.AddSingleton(Options.Create(CreateSiteOptions()));
        return context;
    }

    /// <summary>Registers the real topic state and the fakes for the three HTTP clients. The FHIR fake is reachable through <see cref="AddFhirClient"/>'s return value when a test needs it.</summary>
    public static (FakeExperienceClient Experience, FakeContactClient Contact, IContactTopicState Topic) AddSiteServices(this BunitContext context)
    {
        var experience = new FakeExperienceClient();
        var contact = new FakeContactClient();
        var topic = new ContactTopicState();
        context.Services.AddSingleton<IExperienceClient>(experience);
        context.Services.AddSingleton<IContactClient>(contact);
        context.Services.AddSingleton<IContactTopicState>(topic);
        context.AddFhirClient();
        context.AddSiteOptions();
        return (experience, contact, topic);
    }

    /// <summary>Registers a fake <see cref="IFhirClient"/> and returns it for scripting and assertions.</summary>
    public static FakeFhirClient AddFhirClient(this BunitContext context)
    {
        var fhir = new FakeFhirClient();
        context.Services.AddSingleton<IFhirClient>(fhir);
        return fhir;
    }

    /// <summary>
    /// Makes "import ./js/site.js" return a module whose functions all succeed. Functions that
    /// return a handle return null, which the components treat as "nothing to dispose".
    /// </summary>
    public static BunitJSModuleInterop SetupSiteModule(this BunitContext context)
    {
        var module = context.JSInterop.SetupModule("./js/site.js");
        module.Mode = JSRuntimeMode.Loose;
        return module;
    }
}
