using Portfolio.Blazor.Enumerations;

namespace Portfolio.Blazor.Models;

/// <summary>The summary card header, mapped from a FHIR <c>Patient</c>.</summary>
/// <param name="Id">FHIR logical id.</param>
/// <param name="Name">Display name.</param>
/// <param name="FamilyName">Family name.</param>
/// <param name="GivenName">Given names, when present.</param>
/// <param name="Initials">One or two uppercase letters for the avatar.</param>
/// <param name="Sex">Administrative gender, when known.</param>
/// <param name="BirthDate">ISO 8601 date, when known.</param>
/// <param name="Age">Whole years at the time of the request, when the birth date is known.</param>
/// <param name="Mrn">Medical record number, when present.</param>
/// <param name="Identifiers">Every identifier the patient carries.</param>
public sealed record PatientDemographics(
    string Id,
    string Name,
    string FamilyName,
    string? GivenName,
    string Initials,
    Sex? Sex,
    string? BirthDate,
    int? Age,
    string? Mrn,
    IReadOnlyList<Identifier> Identifiers);
