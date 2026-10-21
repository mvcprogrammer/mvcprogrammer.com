using Portfolio.Blazor.Enumerations;

namespace Portfolio.Blazor.Models;

/// <summary>One FHIR <c>Condition</c>. The code is the first SNOMED CT or ICD-10 coding, else the first coding.</summary>
/// <param name="Display">Display text.</param>
/// <param name="Code">The code, when present.</param>
/// <param name="System">The coding system URI, when present.</param>
/// <param name="SystemLabel">Short label for the pill: SNOMED CT, ICD-10-CM, ICD-10, or other.</param>
/// <param name="ClinicalStatus">The clinical status as the sandbox sent it.</param>
/// <param name="OnsetDate">Onset date, when present.</param>
/// <param name="RecordedDate">Recorded date, when present.</param>
public sealed record ConditionItem(
    string Display,
    string? Code,
    string? System,
    string? SystemLabel,
    ClinicalStatus ClinicalStatus,
    string? OnsetDate,
    string? RecordedDate);
