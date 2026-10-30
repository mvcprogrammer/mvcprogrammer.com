using Fhir.Api.Models;
using Hl7.Fhir.Model;

namespace Fhir.Api.Mapping;

/// <summary>
/// Condition to <see cref="ConditionItem"/> and the active/resolved split. Reads the id and what US
/// Core Condition requires: clinicalStatus, code (SNOMED CT or ICD-10-CM preferred), onset, recordedDate.
/// </summary>
public static class ConditionMapper
{
    private const string SNOMED = "http://snomed.info/sct";
    private const string ICD10_CM = "http://hl7.org/fhir/sid/icd-10-cm";
    private const string ICD10 = "http://hl7.org/fhir/sid/icd-10";
    private const string CLINICAL_STATUS_SYSTEM = "http://terminology.hl7.org/CodeSystem/condition-clinical";

    /// <summary>clinicalStatus codes that count as active. Everything else (inactive, remission, resolved) is resolved; a missing status is shown as unknown and kept with the active set so it is not hidden.</summary>
    private static readonly HashSet<string> _activeStatuses = new(StringComparer.Ordinal) { "active", "recurrence", "relapse" };

    public static Conditions Split(IEnumerable<Condition> conditions)
    {
        ArgumentNullException.ThrowIfNull(conditions);
        var items = conditions.Select(ToItem).ToArray();
        return new Conditions(
            NewestFirst(items.Where(IsActive)),
            NewestFirst(items.Where(i => !IsActive(i))));
    }

    public static ConditionItem ToItem(Condition condition)
    {
        ArgumentNullException.ThrowIfNull(condition);
        var coding = PreferredCoding(condition.Code);
        var display = coding?.Display ?? condition.Code?.Text ?? coding?.Code ?? "Unknown condition";
        return new ConditionItem(
            condition.Id,
            display,
            coding?.Code,
            coding?.System,
            coding is null ? null : LabelOf(coding.System),
            ClinicalStatusOf(condition),
            DateOf(condition.Onset),
            DateOf(condition.RecordedDateElement));
    }

    internal static bool IsActive(ConditionItem item) =>
        item.ClinicalStatus == "unknown" || _activeStatuses.Contains(item.ClinicalStatus);

    internal static string ClinicalStatusOf(Condition condition)
    {
        var coding = condition.ClinicalStatus?.Coding.FirstOrDefault(c => c.System == CLINICAL_STATUS_SYSTEM)
            ?? condition.ClinicalStatus?.Coding.FirstOrDefault();
        return string.IsNullOrWhiteSpace(coding?.Code) ? "unknown" : coding.Code;
    }

    internal static Coding? PreferredCoding(CodeableConcept? code)
    {
        if (code is null)
        {
            return null;
        }

        return code.Coding.FirstOrDefault(c => c.System == SNOMED)
            ?? code.Coding.FirstOrDefault(c => c.System == ICD10_CM)
            ?? code.Coding.FirstOrDefault(c => c.System == ICD10)
            ?? code.Coding.FirstOrDefault();
    }

    internal static string LabelOf(string? system) => system switch
    {
        SNOMED => "SNOMED CT",
        ICD10_CM => "ICD-10-CM",
        ICD10 => "ICD-10",
        _ => "other",
    };

    /// <summary>The date part of a FHIR dateTime, Period start, or Age/Range/string onset. Only full dates are kept.</summary>
    internal static string? DateOf(DataType? value) => value switch
    {
        FhirDateTime dt => PatientMapper.FullDate(dt.Value is { Length: >= 10 } v ? v[..10] : dt.Value),
        Date d => PatientMapper.FullDate(d.Value),
        Period p => DateOf(p.StartElement),
        _ => null,
    };

    private static IReadOnlyList<ConditionItem> NewestFirst(IEnumerable<ConditionItem> items) =>
        items.OrderByDescending(i => i.OnsetDate ?? i.RecordedDate ?? string.Empty, StringComparer.Ordinal)
            .ThenBy(i => i.Display, StringComparer.Ordinal)
            .ToArray();
}
