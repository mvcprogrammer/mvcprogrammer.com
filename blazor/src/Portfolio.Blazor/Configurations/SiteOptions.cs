using System.ComponentModel.DataAnnotations;

namespace Portfolio.Blazor.Configurations;

/// <summary>
/// Endpoints the site talks to. Bound from the "Site" section of wwwroot/appsettings.json,
/// so the Lambda URLs live in configuration rather than in components.
/// </summary>
public sealed class SiteOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SECTION = "Site";

    /// <summary>Lambda function URL that receives the contact form as JSON.</summary>
    [Required]
    [Url]
    public string ContactEndpoint { get; init; } = string.Empty;

    /// <summary>Relative base of the Experience API, served by CloudFront on the same origin.</summary>
    [Required]
    public string ExperienceApiBase { get; init; } = "api";

    /// <summary>Relative path of the bundled copy of the positions seed, the fallback when the API is unreachable.</summary>
    [Required]
    public string ExperienceSeedPath { get; init; } = "data/positions.json";

    /// <summary>Relative base of the FHIR API behind the patient explorer, served by CloudFront on the same origin.</summary>
    [Required]
    public string FhirApiBase { get; init; } = "api/fhir";

    /// <summary>The live kiosk, embedded in the portfolio demo dialog.</summary>
    [Required]
    [Url]
    public string KioskUrl { get; init; } = string.Empty;

    /// <summary>Lambda function URL that records a resume download and redirects to the PDF.</summary>
    [Required]
    [Url]
    public string ResumeUrl { get; init; } = string.Empty;
}
