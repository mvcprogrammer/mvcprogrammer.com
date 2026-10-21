using System.Globalization;
using Portfolio.Blazor.Models;

namespace Portfolio.Blazor.Extensions;

/// <summary>Display helpers for the patient explorer's rows, summary card, and vitals table.</summary>
public static class FhirLabelExtensions
{
    /// <summary>Avatar colour classes available in the stylesheet.</summary>
    public const int AVATAR_HUES = 8;

    /// <summary>A stable colour per patient id, so the same patient keeps its avatar between searches.</summary>
    /// <param name="id">The FHIR logical id.</param>
    public static int ToAvatarHue(this string id)
    {
        ArgumentNullException.ThrowIfNull(id);

        uint hash = 0;
        foreach (var c in id)
        {
            hash = unchecked(hash * 31 + c);
        }

        return (int)(hash % AVATAR_HUES);
    }

    /// <summary>The avatar's classes: base, the small variant for list rows, and the hue.</summary>
    /// <param name="id">The patient id the hue is keyed on.</param>
    /// <param name="small">True for the list row avatar.</param>
    public static string ToAvatarClass(this string id, bool small) =>
        $"fhir-avatar{(small ? " fhir-avatar-sm" : string.Empty)} fhir-avatar-{id.ToAvatarHue()}";

    /// <summary>One or two letters for a list row's avatar, from the given and family names.</summary>
    /// <param name="patient">The search row.</param>
    public static string ToInitials(this PatientListItem patient)
    {
        ArgumentNullException.ThrowIfNull(patient);

        var given = string.IsNullOrEmpty(patient.GivenName) ? string.Empty : patient.GivenName[..1];
        var family = string.IsNullOrEmpty(patient.FamilyName) || string.Equals(patient.FamilyName, "Unknown", StringComparison.Ordinal) ? string.Empty : patient.FamilyName[..1];
        var initials = (given + family).ToUpperInvariant();
        return initials.Length == 0 ? "?" : initials;
    }

    /// <summary>The line under a list row's name: birth year, sex, and the resource reference.</summary>
    /// <param name="patient">The search row.</param>
    public static string ToRowLabel(this PatientListItem patient)
    {
        ArgumentNullException.ThrowIfNull(patient);

        var parts = new List<string>
        {
            patient.BirthYear is null ? "birth year unknown" : $"born {patient.BirthYear}",
        };
        if (patient.Sex is not null)
        {
            parts.Add(patient.Sex.Value.ToLabel());
        }

        parts.Add($"Patient/{patient.Id}");
        return string.Join(" · ", parts);
    }

    /// <summary>The lowercase code the API sent for a sex, as the static edition shows it.</summary>
    /// <param name="sex">The administrative gender.</param>
    public static string ToLabel(this Enumerations.Sex sex) => sex.ToString().ToLowerInvariant();

    /// <summary>The age for the summary header, or the birth date, or a note that neither is known.</summary>
    /// <param name="patient">The demographics.</param>
    public static string ToAgeLabel(this PatientDemographics patient)
    {
        ArgumentNullException.ThrowIfNull(patient);

        if (patient.Age is not null)
        {
            return $"{patient.Age} years";
        }

        return string.IsNullOrEmpty(patient.BirthDate) ? "age unknown" : $"born {patient.BirthDate}";
    }

    /// <summary>The code shown on a condition pill, prefixed with its system label when that is informative.</summary>
    /// <param name="condition">The condition.</param>
    public static string ToPillCode(this ConditionItem condition)
    {
        ArgumentNullException.ThrowIfNull(condition);

        var prefix = !string.IsNullOrEmpty(condition.SystemLabel) && !string.Equals(condition.SystemLabel, "other", StringComparison.Ordinal) ? condition.SystemLabel + " " : string.Empty;
        return prefix + (condition.Code ?? string.Empty);
    }

    /// <summary>The pill's tooltip, when the condition has an onset date.</summary>
    /// <param name="condition">The condition.</param>
    public static string? ToPillTitle(this ConditionItem condition)
    {
        ArgumentNullException.ThrowIfNull(condition);

        return string.IsNullOrEmpty(condition.OnsetDate) ? null : $"Onset {condition.OnsetDate} · {condition.ClinicalStatus.ToString().ToLowerInvariant()}";
    }

    /// <summary>A number rounded to two decimals in invariant form, or an empty string when absent.</summary>
    /// <param name="value">The value.</param>
    public static string ToNumberLabel(this double? value) =>
        value is null ? string.Empty : Math.Round(value.Value, 2).ToString(CultureInfo.InvariantCulture);

    /// <summary>The value column of the vitals table: components joined with a slash (blood pressure), else value and unit.</summary>
    /// <param name="vital">The vital sign.</param>
    public static string ToValueLabel(this VitalSign vital)
    {
        ArgumentNullException.ThrowIfNull(vital);

        if (vital.Components is { Count: > 0 })
        {
            return $"{string.Join("/", vital.Components.Select(c => ((double?)c.Value).ToNumberLabel()))} {vital.Components[0].Unit}".Trim();
        }

        return $"{vital.Value.ToNumberLabel()} {vital.Unit}".Trim();
    }

    /// <summary>
    /// "2025-11-03T09:14:00Z" becomes the date and the clock time as sent; a bare date or year has no time.
    /// The WebAssembly build ships no time zone data, so the time is shown in the offset the sandbox sent.
    /// </summary>
    /// <param name="iso">The ISO 8601 date or date-time.</param>
    public static (string Date, string Time) ToDateParts(this string iso)
    {
        ArgumentNullException.ThrowIfNull(iso);

        if (iso.Length <= 10)
        {
            return (iso, string.Empty);
        }

        if (!DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var moment))
        {
            return (iso[..10], string.Empty);
        }

        return (moment.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), moment.ToString("HH:mm", CultureInfo.InvariantCulture));
    }

    /// <summary>The X-Cache note for the log.</summary>
    /// <param name="xCache">CloudFront's X-Cache header, or null when no edge answered.</param>
    public static string ToCacheLabel(this string? xCache) =>
        xCache is null ? "X-Cache: n/a (no CloudFront in front of this origin)" : "X-Cache: " + xCache;
}
