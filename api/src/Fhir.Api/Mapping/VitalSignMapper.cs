using Fhir.Api.Models;
using Hl7.Fhir.Model;

namespace Fhir.Api.Mapping;

/// <summary>
/// Observation to <see cref="VitalSign"/>, selected by the LOINC codes the US Core Vital Signs
/// profiles fix. Blood pressure (85354-9) has no value of its own; its systolic (8480-6) and
/// diastolic (8462-4) components are carried instead.
/// </summary>
public static class VitalSignMapper
{
    private const string LOINC = "http://loinc.org";

    /// <summary>LOINC code to the name the page shows. Order is irrelevant; results sort by date.</summary>
    private static readonly IReadOnlyDictionary<string, string> _vitals = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["85354-9"] = "Blood pressure",
        ["8867-4"] = "Heart rate",
        ["29463-7"] = "Body weight",
        ["8302-2"] = "Body height",
        ["8310-5"] = "Body temperature",
        ["9279-1"] = "Respiratory rate",
        ["2708-6"] = "Oxygen saturation",
        ["59408-5"] = "Oxygen saturation",
        ["39156-5"] = "Body mass index",
    };

    private static readonly IReadOnlyDictionary<string, string> _components = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["8480-6"] = "Systolic",
        ["8462-4"] = "Diastolic",
    };

    private static readonly string[] _componentOrder = ["8480-6", "8462-4"];

    /// <summary>Keeps the observations with a known LOINC code and a usable value, newest first, at most <paramref name="max"/>.</summary>
    public static IReadOnlyList<VitalSign> Select(IEnumerable<Observation> observations, int max)
    {
        ArgumentNullException.ThrowIfNull(observations);
        return observations
            .Select(ToVitalSign)
            .OfType<VitalSign>()
            .OrderByDescending(v => v.Date, StringComparer.Ordinal)
            .ThenBy(v => v.Name, StringComparer.Ordinal)
            .Take(max)
            .ToArray();
    }

    /// <summary>Null when the observation is not one of the tracked vitals, has no date, or carries no quantity.</summary>
    public static VitalSign? ToVitalSign(Observation observation)
    {
        ArgumentNullException.ThrowIfNull(observation);
        var code = LoincOf(observation.Code);
        if (code is null || !_vitals.TryGetValue(code, out var name))
        {
            return null;
        }

        var date = DateOf(observation.Effective);
        if (date is null)
        {
            return null;
        }

        if (observation.Value is Quantity quantity && quantity.Value is not null)
        {
            return new VitalSign(date, name, code, quantity.Value, UnitOf(quantity), null);
        }

        // Systolic before diastolic whatever order the sandbox sent them in, so the page can print 120/80.
        var components = observation.Component
            .Select(c => (Code: LoincOf(c.Code), Quantity: c.Value as Quantity))
            .Where(c => c.Code is not null && _components.ContainsKey(c.Code) && c.Quantity?.Value is not null)
            .OrderBy(c => Array.IndexOf(_componentOrder, c.Code!))
            .Select(c => new VitalComponent(_components[c.Code!], c.Code!, c.Quantity!.Value!.Value, UnitOf(c.Quantity)))
            .ToArray();
        return components.Length == 0 ? null : new VitalSign(date, name, code, null, null, components);
    }

    internal static string? LoincOf(CodeableConcept? concept) =>
        concept?.Coding.FirstOrDefault(c => c.System == LOINC && !string.IsNullOrWhiteSpace(c.Code))?.Code;

    /// <summary>effectiveDateTime as sent, or the start of effectivePeriod. Instants and partial dates pass through; the page formats them.</summary>
    internal static string? DateOf(DataType? effective) => effective switch
    {
        FhirDateTime dt when !string.IsNullOrWhiteSpace(dt.Value) => dt.Value,
        Instant i when i.Value is not null => i.Value.Value.ToString("yyyy-MM-dd'T'HH:mm:ssK", System.Globalization.CultureInfo.InvariantCulture),
        Period p => DateOf(p.StartElement),
        _ => null,
    };

    private static string UnitOf(Quantity quantity) => quantity.Unit ?? quantity.Code ?? string.Empty;
}
