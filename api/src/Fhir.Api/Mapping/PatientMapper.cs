using System.Globalization;
using Fhir.Api.Models;
using Hl7.Fhir.Model;
using ModelIdentifier = Fhir.Api.Models.Identifier;

namespace Fhir.Api.Mapping;

/// <summary>
/// Patient to the two DTOs. Reads the fields US Core Patient makes mandatory or must-support:
/// identifier, name (family, given), gender, birthDate. Nothing else leaves the function.
/// </summary>
public static class PatientMapper
{
    /// <summary>The v2-0203 identifier type for a medical record number.</summary>
    private const string MRN_TYPE_CODE = "MR";

    /// <summary>Shown when the record carries no usable family name.</summary>
    private const string UNKNOWN = "Unknown";

    public static PatientListItem ToListItem(Patient patient)
    {
        ArgumentNullException.ThrowIfNull(patient);
        var (family, given, display) = NameOf(patient);
        var birthDate = FullDate(patient.BirthDate);
        return new PatientListItem(
            patient.Id ?? string.Empty,
            display,
            family.Length == 0 ? UNKNOWN : family,
            given,
            birthDate,
            YearOf(patient.BirthDate),
            SexOf(patient.Gender),
            MrnOf(patient));
    }

    public static PatientDemographics ToDemographics(Patient patient, DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(patient);
        var (family, given, display) = NameOf(patient);
        var birthDate = FullDate(patient.BirthDate);
        return new PatientDemographics(
            patient.Id ?? string.Empty,
            display,
            family.Length == 0 ? UNKNOWN : family,
            given,
            InitialsOf(given, family),
            SexOf(patient.Gender),
            birthDate,
            AgeOf(birthDate, today),
            MrnOf(patient),
            patient.Identifier
                .Where(i => !string.IsNullOrWhiteSpace(i.Value))
                .Select(i => new ModelIdentifier(i.System, i.Value!, TypeCodeOf(i)))
                .ToArray());
    }

    /// <summary>The official name when there is one, else the first. The family comes back as found (possibly empty); the display is family alone, given alone, or "Unknown".</summary>
    internal static (string Family, string? Given, string Display) NameOf(Patient patient)
    {
        var name = patient.Name.FirstOrDefault(n => n.Use == HumanName.NameUse.Official) ?? patient.Name.FirstOrDefault();
        var family = name?.Family?.Trim() ?? string.Empty;
        var given = name is null ? null : string.Join(' ', name.Given.Where(g => !string.IsNullOrWhiteSpace(g)).Select(g => g!.Trim()));
        if (string.IsNullOrEmpty(given))
        {
            given = null;
        }

        var display = (family, given) switch
        {
            ("", null) => UNKNOWN,
            ("", { } g) => g,
            (_, null) => family,
            _ => $"{family}, {given}",
        };
        return (family, given, display);
    }

    internal static string InitialsOf(string? given, string family)
    {
        var initials = string.Empty;
        var first = given?.FirstOrDefault(char.IsLetter) ?? '\0';
        var second = family.FirstOrDefault(char.IsLetter);
        if (first != '\0')
        {
            initials += char.ToUpperInvariant(first);
        }

        if (second != '\0')
        {
            initials += char.ToUpperInvariant(second);
        }

        return initials.Length == 0 ? "?" : initials;
    }

    internal static Sex? SexOf(AdministrativeGender? gender) => gender switch
    {
        AdministrativeGender.Male => Sex.Male,
        AdministrativeGender.Female => Sex.Female,
        AdministrativeGender.Other => Sex.Other,
        AdministrativeGender.Unknown => Sex.Unknown,
        _ => null,
    };

    /// <summary>FHIR dates may be a year or a year-month; only a full date is passed through.</summary>
    internal static string? FullDate(string? fhirDate) =>
        fhirDate is not null && DateOnly.TryParseExact(fhirDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
            ? fhirDate
            : null;

    internal static int? YearOf(string? fhirDate) =>
        fhirDate is { Length: >= 4 } && int.TryParse(fhirDate.AsSpan(0, 4), NumberStyles.None, CultureInfo.InvariantCulture, out var year)
            ? year
            : null;

    internal static int? AgeOf(string? birthDate, DateOnly today)
    {
        if (birthDate is null)
        {
            return null;
        }

        var born = DateOnly.ParseExact(birthDate, "yyyy-MM-dd", CultureInfo.InvariantCulture);
        var age = today.Year - born.Year;
        if (today < born.AddYears(age))
        {
            age--;
        }

        return age < 0 ? null : age;
    }

    internal static string? MrnOf(Patient patient)
    {
        var mrn = patient.Identifier.FirstOrDefault(i => TypeCodeOf(i) == MRN_TYPE_CODE && !string.IsNullOrWhiteSpace(i.Value))
            ?? patient.Identifier.FirstOrDefault(i => !string.IsNullOrWhiteSpace(i.Value));
        return mrn?.Value;
    }

    private static string? TypeCodeOf(Hl7.Fhir.Model.Identifier identifier) =>
        identifier.Type?.Coding.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.Code))?.Code;
}
