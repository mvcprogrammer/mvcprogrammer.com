using Hl7.Fhir.Model;
using FhirIdentifier = Hl7.Fhir.Model.Identifier;

namespace Hl7.Etl.Mappers;

/// <summary>
/// The identifiers every resource the ETL writes carries, all under one system, so a conditional
/// create can match on them (a rerun is a no-op) and one search lists the whole cohort.
/// </summary>
public static class EtlIdentifiers
{
    /// <summary>The v2-0203 code system and the code for a medical record number, the same the explorer reads.</summary>
    public const string V2_0203 = "http://terminology.hl7.org/CodeSystem/v2-0203";
    /// <summary>The v2-0203 code for a medical record number.</summary>
    public const string MRN_TYPE_CODE = "MR";

    /// <summary>The v2-0203 code for a visit number.</summary>
    public const string VISIT_TYPE_CODE = "VN";

    /// <summary>The patient's identifier: the MRN from PID-3, typed MR so the explorer shows it as the MRN.</summary>
    public static FhirIdentifier Patient(Uri system, string mrn) => Typed(system, mrn, MRN_TYPE_CODE);

    /// <summary>The encounter's identifier: the visit number from PV1-19, typed VN.</summary>
    public static FhirIdentifier Encounter(Uri system, string visitNumber) => Typed(system, visitNumber, VISIT_TYPE_CODE);

    /// <summary>An observation's identifier: the message control id and the OBX set id, unique per result.</summary>
    public static FhirIdentifier Observation(Uri system, string messageControlId, string setId) => new(system.ToString(), $"{messageControlId}-{setId}");

    /// <summary>The FHIR token search for an identifier in the system: <c>system|value</c>.</summary>
    public static string Token(Uri system, string value) => $"{system}|{value}";

    /// <summary>A conditional reference a transaction resolves server-side: <c>Patient?identifier=system|value</c>.</summary>
    public static string ConditionalReference(string resourceType, Uri system, string value) => $"{resourceType}?identifier={Uri.EscapeDataString(Token(system, value))}";

    private static FhirIdentifier Typed(Uri system, string value, string typeCode) => new(system.ToString(), value)
    {
        Type = new CodeableConcept(V2_0203, typeCode),
    };
}
