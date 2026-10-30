using Fhir.Api.Models;

namespace Fhir.Api.Fhir;

/// <summary>
/// The ten conditions a visitor may add, with their SNOMED CT concept ids. The function is the
/// source of truth: openapi.yaml documents the same table on addCondition and the explorer
/// mirrors it, but only a code found here reaches the sandbox.
/// </summary>
public static class ConditionPickList
{
    /// <summary>The coding system of every entry.</summary>
    public const string SNOMED_SYSTEM = "http://snomed.info/sct";

    /// <summary>The entries in the order the explorer lists them.</summary>
    public static IReadOnlyList<PickListCondition> All { get; } =
    [
        new("59621000", "Essential hypertension"),
        new("44054006", "Type 2 diabetes mellitus"),
        new("55822004", "Hyperlipidemia"),
        new("195967001", "Asthma"),
        new("13645005", "Chronic obstructive pulmonary disease"),
        new("235595009", "Gastroesophageal reflux disease"),
        new("40930008", "Hypothyroidism"),
        new("396275006", "Osteoarthritis"),
        new("35489007", "Depressive disorder"),
        new("49436004", "Atrial fibrillation"),
    ];

    private static readonly Dictionary<string, PickListCondition> _byCode = All.ToDictionary(c => c.Code, StringComparer.Ordinal);

    /// <summary>The entry for a code, or null when the code is not on the list.</summary>
    public static PickListCondition? Find(string? code) =>
        code is not null && _byCode.TryGetValue(code, out var entry) ? entry : null;
}
