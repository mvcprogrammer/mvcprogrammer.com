using Portfolio.Blazor.Enumerations;

namespace Portfolio.Blazor.Models;

/// <summary>One row of the patient search results, mapped from a FHIR <c>Patient</c> (see api/openapi.yaml).</summary>
/// <param name="Id">FHIR logical id.</param>
/// <param name="Name">Display name, <c>Family, Given</c>.</param>
/// <param name="FamilyName">Family name.</param>
/// <param name="GivenName">Given names joined by a space, when present.</param>
/// <param name="BirthDate">ISO 8601 date, when known.</param>
/// <param name="BirthYear">Year of the birth date, for the row label.</param>
/// <param name="Sex">Administrative gender, when known.</param>
/// <param name="Mrn">Medical record number, when the patient carries one.</param>
public sealed record PatientListItem(
    string Id,
    string Name,
    string FamilyName,
    string? GivenName,
    string? BirthDate,
    int? BirthYear,
    Sex? Sex,
    string? Mrn);
