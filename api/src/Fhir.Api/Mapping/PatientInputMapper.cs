using Fhir.Api.Fhir;
using Fhir.Api.Models;
using Hl7.Fhir.Model;
using FhirIdentifier = Hl7.Fhir.Model.Identifier;

namespace Fhir.Api.Mapping;

/// <summary>
/// <see cref="PatientInput"/> to and from a FHIR Patient. The five input fields are the only
/// thing a visitor can write; the function adds the session and idempotency identifiers itself,
/// and a replacement keeps them from the stored resource, so nothing else ever reaches the sandbox.
/// </summary>
public static class PatientInputMapper
{
    /// <summary>A new Patient for a create: the input, the session identifier, and the idempotency identifier.</summary>
    public static Patient ToNewPatient(PatientInput input, string sessionToken, string idempotencyKey)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionToken);
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);

        var patient = new Patient();
        Apply(patient, input);
        patient.Identifier.Add(new FhirIdentifier(DemoIdentifiers.SESSION_SYSTEM, sessionToken));
        patient.Identifier.Add(new FhirIdentifier(DemoIdentifiers.IDEMPOTENCY_SYSTEM, idempotencyKey));
        return patient;
    }

    /// <summary>The stored Patient with the input written over its demographics. The id, the session identifier, and the idempotency identifier are kept; everything else is replaced.</summary>
    public static Patient ToReplacement(Patient stored, PatientInput input)
    {
        ArgumentNullException.ThrowIfNull(stored);
        ArgumentNullException.ThrowIfNull(input);

        var patient = new Patient { Id = stored.Id, Meta = stored.Meta };
        Apply(patient, input);
        foreach (var kept in stored.Identifier.Where(i => i.System is DemoIdentifiers.SESSION_SYSTEM or DemoIdentifiers.IDEMPOTENCY_SYSTEM))
        {
            patient.Identifier.Add(kept);
        }

        return patient;
    }

    /// <summary>The input view of a stored Patient, the document a patch is applied to.</summary>
    public static PatientInput ToInput(Patient stored)
    {
        ArgumentNullException.ThrowIfNull(stored);
        var (family, given, _) = PatientMapper.NameOf(stored);
        var mrn = stored.Identifier.FirstOrDefault(i => i.System == DemoIdentifiers.MRN_SYSTEM && !string.IsNullOrWhiteSpace(i.Value))?.Value
            ?? PatientMapper.MrnOf(stored);
        return new PatientInput(family, given, PatientMapper.SexOf(stored.Gender), PatientMapper.FullDate(stored.BirthDate), mrn);
    }

    /// <summary>The session token a stored Patient carries, or null when it was not created by the explorer.</summary>
    public static string? SessionTokenOf(Patient stored)
    {
        ArgumentNullException.ThrowIfNull(stored);
        return stored.Identifier.FirstOrDefault(i => i.System == DemoIdentifiers.SESSION_SYSTEM)?.Value;
    }

    private static void Apply(Patient patient, PatientInput input)
    {
        var name = new HumanName { Use = HumanName.NameUse.Official, Family = input.FamilyName.Trim() };
        if (!string.IsNullOrWhiteSpace(input.GivenName))
        {
            name.Given = [input.GivenName.Trim()];
        }

        patient.Name.Add(name);
        patient.Gender = input.Sex switch
        {
            Sex.Male => AdministrativeGender.Male,
            Sex.Female => AdministrativeGender.Female,
            Sex.Other => AdministrativeGender.Other,
            Sex.Unknown => AdministrativeGender.Unknown,
            _ => null,
        };
        patient.BirthDate = input.BirthDate;
        if (!string.IsNullOrWhiteSpace(input.Mrn))
        {
            patient.Identifier.Add(new FhirIdentifier(DemoIdentifiers.MRN_SYSTEM, input.Mrn.Trim())
            {
                Type = new CodeableConcept(DemoIdentifiers.V2_0203, DemoIdentifiers.MRN_TYPE_CODE),
            });
        }
    }
}
