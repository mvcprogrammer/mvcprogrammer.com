using System.Globalization;
using Fhir.Api.Fhir;
using Fhir.Api.Models;
using Hl7.Fhir.Model;
using Hl7.Fhir.Rest;

namespace Fhir.Api.Mapping;

/// <summary>
/// A pick-list entry to the FHIR Condition the function records, the two searches the add makes
/// (the active count for the cap and the If-None-Exist that makes the create conditional), and the
/// resolved transition. Nothing the visitor sends reaches the sandbox except the code, and only
/// after it was found on the list.
/// </summary>
public static class ConditionInputMapper
{
    private const string CLINICAL_STATUS_SYSTEM = "http://terminology.hl7.org/CodeSystem/condition-clinical";
    private const string CATEGORY_SYSTEM = "http://terminology.hl7.org/CodeSystem/condition-category";

    /// <summary>The clinicalStatus code of a condition the add records, and the value the two searches filter on.</summary>
    public const string ACTIVE = "active";

    /// <summary>The clinicalStatus code the resolve sets.</summary>
    public const string RESOLVED = "resolved";

    /// <summary>A new Condition: active, a problem-list item, the SNOMED CT coding and display from the list, the patient as subject, and today as recordedDate.</summary>
    public static Condition ToNewCondition(PickListCondition entry, string patientId, DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(entry);
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);

        return new Condition
        {
            ClinicalStatus = new CodeableConcept(CLINICAL_STATUS_SYSTEM, ACTIVE),
            Category = [new CodeableConcept(CATEGORY_SYSTEM, "problem-list-item", "Problem List Item")],
            // The four-argument constructor sets the coding's display; the three-argument one sets only text.
            Code = new CodeableConcept(ConditionPickList.SNOMED_SYSTEM, entry.Code, entry.Display, entry.Display),
            Subject = new ResourceReference(SubjectReference(patientId)),
            RecordedDate = today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        };
    }

    /// <summary>Condition?patient=, every condition of the patient, for the cascade a patient delete runs.</summary>
    public static SearchParams ConditionsOfPatientQuery(string patientId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);
        return new SearchParams().Add("patient", SubjectReference(patientId));
    }

    /// <summary>Condition?patient=&amp;clinical-status=active, for the count the cap is checked against.</summary>
    public static SearchParams ActiveConditionsQuery(string patientId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);
        return new SearchParams()
            .Add("patient", SubjectReference(patientId))
            .Add("clinical-status", ACTIVE);
    }

    /// <summary>The If-None-Exist of the create: the same patient, the same code, still active. A match returns the existing resource; a resolved one does not match, so it can be added again.</summary>
    public static SearchParams ExistingActiveQuery(string patientId, PickListCondition entry)
    {
        ArgumentNullException.ThrowIfNull(entry);
        return ActiveConditionsQuery(patientId)
            .Add("code", DemoIdentifiers.Token(ConditionPickList.SNOMED_SYSTEM, entry.Code));
    }

    /// <summary>The stored Condition with clinicalStatus resolved and abatementDateTime today; everything else, the id included, is kept.</summary>
    public static Condition ToResolved(Condition stored, DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(stored);
        var resolved = (Condition)stored.DeepCopy();
        resolved.ClinicalStatus = new CodeableConcept(CLINICAL_STATUS_SYSTEM, RESOLVED);
        resolved.Abatement = new FhirDateTime(today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        return resolved;
    }

    /// <summary>True when the condition's subject is the patient: a relative reference (Patient/1842), an absolute one, or a versioned one (.../Patient/1842/_history/2).</summary>
    public static bool References(Condition condition, string patientId)
    {
        ArgumentNullException.ThrowIfNull(condition);
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);

        var reference = condition.Subject?.Reference;
        if (string.IsNullOrWhiteSpace(reference))
        {
            return false;
        }

        var segments = reference.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var type = Array.LastIndexOf(segments, nameof(Patient));
        return type >= 0 && type + 1 < segments.Length && string.Equals(segments[type + 1], patientId, StringComparison.Ordinal);
    }

    private static string SubjectReference(string patientId) => $"Patient/{patientId}";
}
