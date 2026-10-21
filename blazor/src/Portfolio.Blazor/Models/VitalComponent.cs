namespace Portfolio.Blazor.Models;

/// <summary>One <c>Observation.component</c>, used by blood pressure (systolic and diastolic).</summary>
/// <param name="Name">Component name.</param>
/// <param name="LoincCode">LOINC code.</param>
/// <param name="Value">Numeric value.</param>
/// <param name="Unit">UCUM unit.</param>
public sealed record VitalComponent(string Name, string LoincCode, double Value, string Unit);
