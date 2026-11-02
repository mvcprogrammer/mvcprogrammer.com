namespace Hl7.Etl.Generators;

/// <summary>One synthetic patient of the generated cohort, the facts the messages are composed from.</summary>
/// <param name="Mrn">The medical record number, the patient's identifier in every message and resource.</param>
/// <param name="FamilyName">Family name.</param>
/// <param name="GivenName">Given name.</param>
/// <param name="Sex">HL7 v2 administrative sex: F, M, or O.</param>
/// <param name="BirthDate">Date of birth.</param>
/// <param name="VisitNumber">The visit number of the admission (PV1-19).</param>
/// <param name="AdmittedAt">When the admission happened.</param>
/// <param name="Ward">The ward of the admission (PV1-3.1).</param>
public sealed record SyntheticPatient(
    string Mrn,
    string FamilyName,
    string GivenName,
    string Sex,
    DateOnly BirthDate,
    string VisitNumber,
    DateTimeOffset AdmittedAt,
    string Ward);
