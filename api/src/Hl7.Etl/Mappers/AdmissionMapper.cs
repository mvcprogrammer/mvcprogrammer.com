using Efferent.HL7.V2;
using Hl7.Etl.Exceptions;
using Hl7.Etl.Models;
using Hl7.Fhir.Model;

namespace Hl7.Etl.Mappers;

/// <summary>
/// ADT^A01 to a Patient (PID: MRN, name, sex, birth date) and an Encounter (PV1: class, ward,
/// visit number, admit time). The encounter references the patient by a conditional reference,
/// which the loader turns into an in-bundle reference when the patient is in the same batch.
/// </summary>
public static class AdmissionMapper
{
    /// <summary>The v3 ActCode system of Encounter.class.</summary>
    public const string ACT_CODE = "http://terminology.hl7.org/CodeSystem/v3-ActCode";

    /// <summary>The patient and the encounter, in that order.</summary>
    public static IReadOnlyList<Resource> Map(LandedMessage landed, Uri identifierSystem)
    {
        ArgumentNullException.ThrowIfNull(landed);
        ArgumentNullException.ThrowIfNull(identifierSystem);

        var controlId = landed.MessageControlId;
        var message = Hl7Values.Parse(controlId, landed.RawMessage);
        var pid = Hl7Values.Required(message, controlId, "PID");
        var pv1 = Hl7Values.Required(message, controlId, "PV1");

        var patient = ToPatient(pid, controlId, identifierSystem);
        var mrn = Hl7Values.RequiredText(controlId, "PID.3.1", Hl7Values.Component(pid, 3, 1));
        var visitNumber = Hl7Values.RequiredText(controlId, "PV1.19", Hl7Values.Field(pv1, 19));
        var encounter = new Encounter
        {
            Identifier = [EtlIdentifiers.Encounter(identifierSystem, visitNumber)],
            Status = Encounter.EncounterStatus.InProgress,
            Class = ToClass(controlId, Hl7Values.Field(pv1, 2)),
            Subject = new ResourceReference(EtlIdentifiers.ConditionalReference("Patient", identifierSystem, mrn)),
            Period = new Period { StartElement = ToFhirDateTime(Hl7Values.Instant(controlId, "PV1.44", Hl7Values.RequiredText(controlId, "PV1.44", Hl7Values.Field(pv1, 44)))) },
        };

        var ward = Hl7Values.Component(pv1, 3, 1);
        if (!string.IsNullOrWhiteSpace(ward))
        {
            encounter.Location.Add(new Encounter.LocationComponent { Location = new ResourceReference { Display = ward } });
        }

        return [patient, encounter];
    }

    /// <summary>A Patient from a PID segment: the ETL identifier (the MRN, typed MR), the official name, sex, and birth date.</summary>
    public static Patient ToPatient(Segment pid, string controlId, Uri identifierSystem)
    {
        ArgumentNullException.ThrowIfNull(pid);
        ArgumentNullException.ThrowIfNull(identifierSystem);

        var mrn = Hl7Values.RequiredText(controlId, "PID.3.1", Hl7Values.Component(pid, 3, 1));
        var family = Hl7Values.RequiredText(controlId, "PID.5.1", Hl7Values.Component(pid, 5, 1));
        var given = Hl7Values.Component(pid, 5, 2);
        var patient = new Patient
        {
            Identifier = [EtlIdentifiers.Patient(identifierSystem, mrn)],
            Name = [new HumanName { Use = HumanName.NameUse.Official, Family = family, Given = string.IsNullOrWhiteSpace(given) ? [] : [given.Trim()] }],
            Gender = ToGender(Hl7Values.Field(pid, 8)),
        };

        var birth = Hl7Values.Field(pid, 7);
        if (!string.IsNullOrWhiteSpace(birth))
        {
            patient.BirthDate = Hl7Values.Date(controlId, "PID.7", birth.Trim()).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
        }

        return patient;
    }

    /// <summary>HL7 v2 administrative sex (table 0001) to FHIR administrative gender; anything unlisted is unknown.</summary>
    public static AdministrativeGender ToGender(string sex) => sex.Trim().ToUpperInvariant() switch
    {
        "F" => AdministrativeGender.Female,
        "M" => AdministrativeGender.Male,
        "O" => AdministrativeGender.Other,
        _ => AdministrativeGender.Unknown,
    };

    /// <summary>PV1-2 patient class (table 0004) to the v3 ActCode class.</summary>
    public static Coding ToClass(string controlId, string patientClass) => patientClass.Trim().ToUpperInvariant() switch
    {
        "I" => new Coding(ACT_CODE, "IMP", "inpatient encounter"),
        "O" => new Coding(ACT_CODE, "AMB", "ambulatory"),
        "E" => new Coding(ACT_CODE, "EMER", "emergency"),
        "" => throw new Hl7MappingException(controlId, "PV1.2", "Required and empty."),
        var other => throw new Hl7MappingException(controlId, "PV1.2", $"'{other}' is not a patient class this feed sends (I, O, E)."),
    };

    /// <summary>An instant as a FHIR dateTime with seconds and the UTC offset.</summary>
    public static FhirDateTime ToFhirDateTime(DateTimeOffset at) => new(at);
}
