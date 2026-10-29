using System.Globalization;
using System.Text.RegularExpressions;
using Fhir.Api.Models;

namespace Fhir.Api.Mapping;

/// <summary>The rules openapi.yaml states for <see cref="PatientInput"/>, as one error list per field.</summary>
public static partial class PatientInputValidator
{
    public const int MAX_NAME_LENGTH = 60;
    public const int MAX_MRN_LENGTH = 40;

    /// <summary>Every problem with the input, keyed by field. Empty when it is valid.</summary>
    public static IReadOnlyDictionary<string, string[]> Validate(PatientInput? input, DateOnly today)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        if (input is null)
        {
            Add(errors, "body", "A JSON body with at least 'familyName' is required.");
            return Freeze(errors);
        }

        if (string.IsNullOrWhiteSpace(input.FamilyName) || input.FamilyName.Trim().Length > MAX_NAME_LENGTH)
        {
            Add(errors, "familyName", $"'familyName' is required and must be between 1 and {MAX_NAME_LENGTH} characters.");
        }

        if (input.GivenName is not null && input.GivenName.Trim().Length > MAX_NAME_LENGTH)
        {
            Add(errors, "givenName", $"'givenName' must be at most {MAX_NAME_LENGTH} characters.");
        }

        if (input.BirthDate is not null)
        {
            if (!DateOnly.TryParseExact(input.BirthDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var born))
            {
                Add(errors, "birthDate", "'birthDate' must be a date in YYYY-MM-DD form, not in the future.");
            }
            else if (born > today)
            {
                Add(errors, "birthDate", "'birthDate' must not be in the future.");
            }
        }

        if (input.Mrn is not null && (input.Mrn.Length == 0 || input.Mrn.Length > MAX_MRN_LENGTH || !MrnPattern().IsMatch(input.Mrn)))
        {
            Add(errors, "mrn", $"'mrn' must be 1 to {MAX_MRN_LENGTH} letters, digits, hyphens, or dots.");
        }

        return Freeze(errors);
    }

    private static void Add(Dictionary<string, List<string>> errors, string field, string message)
    {
        if (!errors.TryGetValue(field, out var list))
        {
            list = [];
            errors[field] = list;
        }

        list.Add(message);
    }

    private static Dictionary<string, string[]> Freeze(Dictionary<string, List<string>> errors) =>
        errors.ToDictionary(e => e.Key, e => e.Value.ToArray(), StringComparer.Ordinal);

    [GeneratedRegex(@"^[A-Za-z0-9\-\.]+$")]
    private static partial Regex MrnPattern();
}
