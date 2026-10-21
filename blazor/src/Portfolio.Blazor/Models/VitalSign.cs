namespace Portfolio.Blazor.Models;

/// <summary>One vital-sign <c>Observation</c>, selected by LOINC code. Either value and unit, or components, is present.</summary>
/// <param name="Date">ISO 8601 date or date-time.</param>
/// <param name="Name">Vital sign name.</param>
/// <param name="LoincCode">LOINC code.</param>
/// <param name="Value">Numeric value, when the observation has one.</param>
/// <param name="Unit">The UCUM unit as sent (<c>kg</c>, <c>mm[Hg]</c>, <c>/min</c>), when present.</param>
/// <param name="Components">Components, for blood pressure.</param>
public sealed record VitalSign(
    string Date,
    string Name,
    string LoincCode,
    double? Value,
    string? Unit,
    IReadOnlyList<VitalComponent>? Components);
