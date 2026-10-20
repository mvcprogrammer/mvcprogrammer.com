using Fhir.Api.Models;
using Hl7.Fhir.Model;
using Hl7.Fhir.Utility;

namespace Fhir.Api.Mapping;

/// <summary>CapabilityStatement to the subset the explorer depends on.</summary>
public static class CapabilityMapper
{
    /// <summary>Resource type to the search parameters the explorer uses on it.</summary>
    internal static readonly IReadOnlyList<(string Type, string[] Params)> REQUIRED =
    [
        ("Patient", ["family", "birthdate", "identifier"]),
        ("Condition", ["patient"]),
        ("Observation", ["patient", "category", "date"]),
        ("Encounter", ["patient"]),
    ];

    public static CapabilitySubset ToSubset(CapabilityStatement statement, Uri baseUrl, DateTimeOffset checkedAt)
    {
        ArgumentNullException.ThrowIfNull(statement);
        ArgumentNullException.ThrowIfNull(baseUrl);

        var declared = statement.Rest
            .Where(r => r.Mode == CapabilityStatement.RestfulCapabilityMode.Server)
            .SelectMany(r => r.Resource)
            .ToArray();

        var resources = REQUIRED.Select(required =>
        {
            var resource = declared.FirstOrDefault(r => string.Equals(r.Type?.ToString(), required.Type, StringComparison.Ordinal));
            var supported = resource is not null
                && resource.Interaction.Any(i => i.Code == CapabilityStatement.TypeRestfulInteraction.Read)
                && resource.Interaction.Any(i => i.Code == CapabilityStatement.TypeRestfulInteraction.SearchType);
            var searchParams = required.Params
                .Select(name => new ParamSupport(name, resource is not null && resource.SearchParam.Any(sp => sp.Name == name)))
                .ToArray();
            return new ResourceSupport(required.Type, supported, searchParams);
        }).ToArray();

        var ok = resources.All(r => r.Supported && r.SearchParams.All(p => p.Supported));
        return new CapabilitySubset(
            ok,
            statement.FhirVersion?.GetLiteral() ?? "unknown",
            new Software(statement.Software?.Name, statement.Software?.Version),
            baseUrl.ToString().TrimEnd('/'),
            checkedAt,
            resources);
    }
}
