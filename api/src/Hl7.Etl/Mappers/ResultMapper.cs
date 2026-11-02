using Efferent.HL7.V2;
using Hl7.Etl.Exceptions;
using Hl7.Etl.Models;
using Hl7.Fhir.Model;

namespace Hl7.Etl.Mappers;

/// <summary>
/// ORU^R01 to Observations: one per OBX (numeric only, as this feed sends), LOINC code from OBX-3,
/// value and UCUM unit from OBX-5 and OBX-6, status from OBX-11, time from OBX-14 (OBR-7 when
/// absent), the category from the panel in OBR-4. Each references the patient and the encounter
/// by conditional reference on the ETL identifiers.
/// </summary>
public static class ResultMapper
{
    /// <summary>LOINC.</summary>
    public const string LOINC = "http://loinc.org";

    /// <summary>UCUM.</summary>
    public const string UCUM = "http://unitsofmeasure.org";

    /// <summary>The observation category system and its two codes this feed produces.</summary>
    public const string CATEGORY_SYSTEM = "http://terminology.hl7.org/CodeSystem/observation-category";
    /// <summary>The category of a vital-signs observation.</summary>
    public const string VITAL_SIGNS = "vital-signs";

    /// <summary>The category of a laboratory result.</summary>
    public const string LABORATORY = "laboratory";

    /// <summary>The LOINC panel code of a vital-signs report; every other panel is laboratory.</summary>
    public const string VITAL_SIGNS_PANEL = "85353-1";

    /// <summary>The observations of the message, in OBX order.</summary>
    public static IReadOnlyList<Resource> Map(LandedMessage landed, Uri identifierSystem)
    {
        ArgumentNullException.ThrowIfNull(landed);
        ArgumentNullException.ThrowIfNull(identifierSystem);

        var controlId = landed.MessageControlId;
        var message = Hl7Values.Parse(controlId, landed.RawMessage);
        var pid = Hl7Values.Required(message, controlId, "PID");
        var obr = Hl7Values.Required(message, controlId, "OBR");
        var observations = message.Segments("OBX");
        if (observations is null || observations.Count == 0)
        {
            throw new Hl7MappingException(controlId, "OBX", "The message has no OBX segment.");
        }

        var mrn = Hl7Values.RequiredText(controlId, "PID.3.1", Hl7Values.Component(pid, 3, 1));
        var visitNumber = Hl7Values.Field(obr, 18).Trim();
        var panel = Hl7Values.Component(obr, 4, 1).Trim();
        var category = panel == VITAL_SIGNS_PANEL ? VITAL_SIGNS : LABORATORY;
        var reportedAt = Hl7Values.Field(obr, 7).Trim();
        var subject = new ResourceReference(EtlIdentifiers.ConditionalReference("Patient", identifierSystem, mrn));
        var encounter = visitNumber.Length == 0 ? null : new ResourceReference(EtlIdentifiers.ConditionalReference("Encounter", identifierSystem, visitNumber));

        var resources = new List<Resource>(observations.Count);
        foreach (var obx in observations)
        {
            resources.Add(ToObservation(obx, controlId, identifierSystem, category, reportedAt, subject, encounter));
        }

        return resources;
    }

    private static Observation ToObservation(Segment obx, string controlId, Uri identifierSystem, string category, string reportedAt, ResourceReference subject, ResourceReference? encounter)
    {
        var setId = Hl7Values.RequiredText(controlId, "OBX.1", Hl7Values.Field(obx, 1));
        var location = $"OBX[{setId}]";
        var valueType = Hl7Values.Field(obx, 2).Trim().ToUpperInvariant();
        if (valueType != "NM")
        {
            throw new Hl7MappingException(controlId, $"{location}.2", $"'{valueType}' is not a value type this feed maps (NM only).");
        }

        var code = Hl7Values.RequiredText(controlId, $"{location}.3.1", Hl7Values.Component(obx, 3, 1));
        var display = Hl7Values.Component(obx, 3, 2).Trim();
        var value = Hl7Values.Number(controlId, $"{location}.5", Hl7Values.RequiredText(controlId, $"{location}.5", Hl7Values.Field(obx, 5)));
        var unit = Hl7Values.Component(obx, 6, 1).Trim();
        var unitDisplay = Hl7Values.Component(obx, 6, 2).Trim();
        var observedAt = Hl7Values.Field(obx, 14).Trim();
        var at = observedAt.Length > 0 ? Hl7Values.Instant(controlId, $"{location}.14", observedAt) : Hl7Values.Instant(controlId, "OBR.7", Hl7Values.RequiredText(controlId, "OBR.7", reportedAt));

        var observation = new Observation
        {
            Identifier = [EtlIdentifiers.Observation(identifierSystem, controlId, setId)],
            Status = ToStatus(controlId, $"{location}.11", Hl7Values.Field(obx, 11)),
            Category = [new CodeableConcept(CATEGORY_SYSTEM, category)],
            // The three-argument CodeableConcept constructor sets Text, not the coding display, so build the coding by hand.
            Code = new CodeableConcept { Coding = [new Coding(LOINC, code, display.Length == 0 ? null : display)] },
            Subject = subject,
            Encounter = encounter,
            Effective = AdmissionMapper.ToFhirDateTime(at),
            Value = new Quantity
            {
                Value = value,
                Unit = unitDisplay.Length == 0 ? (unit.Length == 0 ? null : unit) : unitDisplay,
                System = unit.Length == 0 ? null : UCUM,
                Code = unit.Length == 0 ? null : unit,
            },
        };
        return observation;
    }

    /// <summary>OBX-11 (table 0085) to the FHIR observation status.</summary>
    public static ObservationStatus ToStatus(string controlId, string location, string resultStatus) => resultStatus.Trim().ToUpperInvariant() switch
    {
        "F" => ObservationStatus.Final,
        "P" => ObservationStatus.Preliminary,
        "C" => ObservationStatus.Corrected,
        "X" => ObservationStatus.Cancelled,
        "" => throw new Hl7MappingException(controlId, location, "Required and empty."),
        var other => throw new Hl7MappingException(controlId, location, $"'{other}' is not a result status this feed maps (F, P, C, X)."),
    };
}
