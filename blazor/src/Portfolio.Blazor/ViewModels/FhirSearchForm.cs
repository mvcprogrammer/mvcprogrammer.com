using System.ComponentModel.DataAnnotations;
using Portfolio.Blazor.Requests;

namespace Portfolio.Blazor.ViewModels;

/// <summary>Mutable model bound to the patient search form. Validated by data annotations before it becomes a <see cref="PatientSearchRequest"/>.</summary>
public sealed class FhirSearchForm
{
    /// <summary>The longest family name the function accepts.</summary>
    public const int FAMILY_MAX_LENGTH = 60;

    /// <summary>The longest identifier the function accepts.</summary>
    public const int IDENTIFIER_MAX_LENGTH = 120;

    /// <summary>Shown when the family name is blank.</summary>
    public const string FAMILY_REQUIRED_MESSAGE = "A family name is required.";

    /// <summary>Shown when the family name is too long.</summary>
    public const string FAMILY_LENGTH_MESSAGE = "At most 60 characters.";

    /// <summary>Shown when the birth date is not an ISO date.</summary>
    public const string BIRTHDATE_FORMAT_MESSAGE = "Use the YYYY-MM-DD form.";

    /// <summary>Family name; matched by the sandbox as a case-insensitive prefix. Whitespace alone counts as missing.</summary>
    [Required(ErrorMessage = FAMILY_REQUIRED_MESSAGE)]
    [StringLength(FAMILY_MAX_LENGTH, ErrorMessage = FAMILY_LENGTH_MESSAGE)]
    public string Family { get; set; } = string.Empty;

    /// <summary>Birth date in ISO form, or empty.</summary>
    [RegularExpression(@"^\d{4}-\d{2}-\d{2}$", ErrorMessage = BIRTHDATE_FORMAT_MESSAGE)]
    public string Birthdate { get; set; } = string.Empty;

    /// <summary>Identifier value, or <c>system|value</c>, or empty.</summary>
    [StringLength(IDENTIFIER_MAX_LENGTH)]
    public string Identifier { get; set; } = string.Empty;

    /// <summary>Builds the request, trimming the free-text fields.</summary>
    public PatientSearchRequest ToRequest() => new(Family.Trim(), Birthdate, Identifier.Trim());
}
