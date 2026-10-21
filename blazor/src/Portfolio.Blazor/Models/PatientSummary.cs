namespace Portfolio.Blazor.Models;

/// <summary>Envelope returned by GET /api/fhir/patients/{id}/summary.</summary>
/// <param name="Patient">Demographics for the header.</param>
/// <param name="Counts">Resource counts.</param>
/// <param name="Conditions">Conditions split on clinical status.</param>
/// <param name="Vitals">Vital signs, newest first, at most 25.</param>
/// <param name="Trace">What happened upstream.</param>
public sealed record PatientSummary(
    PatientDemographics Patient,
    ResourceCounts Counts,
    Conditions Conditions,
    IReadOnlyList<VitalSign> Vitals,
    Trace Trace);
