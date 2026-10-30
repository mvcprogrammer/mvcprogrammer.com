using System.Globalization;
using Fhir.Api.Fhir;
using Fhir.Api.Models;
using Hl7.Fhir.Model;
using Hl7.Fhir.Rest;

namespace Fhir.Api.Mapping;

/// <summary>
/// A pick-list entry to the FHIR Condition the function records, and the two searches the add
/// makes: the active count for the cap and the If-None-Exist that makes the create conditional.
/// Nothing the visitor sends reaches the sandbox except the code, and only after it was found on
/// the list.
/// </summary>
public static class ConditionInputMapper
{
    private const string CLINICAL_STATUS_SYSTEM = "http://terminology.hl7.org/CodeSystem/condition-clinical";
    private const string CATEGORY_SYSTEM = "http://terminology.hl7.org/CodeSystem/condition-category";

    /// <summary>The clinicalStatus code of a condition the add records, and the value the two searches filter on.</summary>
    public const string ACTIVE = "active";

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

    private static string SubjectReference(string patientId) => $"Patient/{patientId}";
}
