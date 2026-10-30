using System.Text.Json.Serialization;

namespace Fhir.Api.Models;

/// <summary>FHIR AdministrativeGender, passed through. Serialised lower-case: male, female, other, unknown.</summary>
public enum Sex
{
    Male,
    Female,
    Other,
    Unknown,
}

/// <summary>The search as the function ran it, echoed back. Mirrors SearchQuery in openapi.yaml.</summary>
public sealed record SearchQuery(
    string Family,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Birthdate,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Identifier);

/// <summary>One row of the search results. Mirrors PatientListItem in openapi.yaml (US Core Patient: name, gender, birthDate, identifier).</summary>
public sealed record PatientListItem(
    string Id,
    string Name,
    string FamilyName,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? GivenName,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? BirthDate,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? BirthYear,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Sex? Sex,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Mrn);

/// <summary>Mirrors PatientSearchResult in openapi.yaml.</summary>
public sealed record PatientSearchResult(
    int Count,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Total,
    SearchQuery Query,
    IReadOnlyList<PatientListItem> Items,
    Trace Trace);

/// <summary>One Patient.identifier. Mirrors Identifier in openapi.yaml.</summary>
public sealed record Identifier(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? System,
    string Value,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Type);

/// <summary>The summary card header. Mirrors PatientDemographics in openapi.yaml.</summary>
public sealed record PatientDemographics(
    string Id,
    string Name,
    string FamilyName,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? GivenName,
    string Initials,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Sex? Sex,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? BirthDate,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Age,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Mrn,
    IReadOnlyList<Identifier> Identifiers);

/// <summary>Exact counts from _summary=count searches. Mirrors ResourceCounts in openapi.yaml.</summary>
public sealed record ResourceCounts(int Conditions, int Encounters, int Observations);

/// <summary>One Condition (US Core Condition). Mirrors ConditionItem in openapi.yaml.</summary>
public sealed record ConditionItem(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id,
    string Display,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Code,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? System,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SystemLabel,
    string ClinicalStatus,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? OnsetDate,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? RecordedDate);

/// <summary>Conditions split on clinicalStatus. Mirrors Conditions in openapi.yaml.</summary>
public sealed record Conditions(IReadOnlyList<ConditionItem> Active, IReadOnlyList<ConditionItem> Resolved);

/// <summary>One Observation.component (blood pressure). Mirrors VitalComponent in openapi.yaml.</summary>
public sealed record VitalComponent(string Name, string LoincCode, decimal Value, string Unit);

/// <summary>One vital-signs Observation (US Core Vital Signs), selected by LOINC code. Mirrors VitalSign in openapi.yaml.</summary>
public sealed record VitalSign(
    string Date,
    string Name,
    string LoincCode,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] decimal? Value,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Unit,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<VitalComponent>? Components);

/// <summary>Mirrors PatientSummary in openapi.yaml.</summary>
public sealed record PatientSummary(
    PatientDemographics Patient,
    ResourceCounts Counts,
    Conditions Conditions,
    IReadOnlyList<VitalSign> Vitals,
    Trace Trace);

/// <summary>Mirrors Health in openapi.yaml.</summary>
public sealed record Health(string Status, string Version);

/// <summary>What a visitor can write about a demo patient. Mirrors PatientInput in openapi.yaml.</summary>
public sealed record PatientInput(
    string FamilyName,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? GivenName,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Sex? Sex,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? BirthDate,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Mrn);

/// <summary>One RFC 6902 operation against the <see cref="PatientInput"/> view of a patient. Mirrors an item of PatientPatch in openapi.yaml.</summary>
public sealed record PatientPatchOperation(
    string Op,
    string Path,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? From,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Value);

/// <summary>What a write returns. Mirrors PatientWriteResult in openapi.yaml.</summary>
public sealed record PatientWriteResult(PatientDemographics Patient, Trace Trace);
