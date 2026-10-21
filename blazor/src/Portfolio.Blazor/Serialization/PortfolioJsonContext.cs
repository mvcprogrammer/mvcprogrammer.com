using System.Text.Json;
using System.Text.Json.Serialization;
using Portfolio.Blazor.Models;
using Portfolio.Blazor.Requests;

namespace Portfolio.Blazor.Serialization;

/// <summary>
/// Source-generated JSON metadata for every type that crosses the wire, so serialisation
/// needs no reflection in the trimmed WebAssembly build. Web defaults give camelCase names.
/// </summary>
[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]
[JsonSerializable(typeof(PositionList))]
[JsonSerializable(typeof(SkillList))]
[JsonSerializable(typeof(IReadOnlyList<Position>))]
[JsonSerializable(typeof(ContactRequest))]
[JsonSerializable(typeof(PatientSearchResult))]
[JsonSerializable(typeof(PatientSummary))]
[JsonSerializable(typeof(CapabilitySubset))]
[JsonSerializable(typeof(ProblemDetails))]
internal sealed partial class PortfolioJsonContext : JsonSerializerContext
{
}
