using System.Text.Json.Serialization;

namespace Portfolio.Blazor.Enumerations;

/// <summary>Where the work happened. The API serialises it in kebab-case.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<WorkMode>))]
public enum WorkMode
{
    /// <summary>Fully remote.</summary>
    [JsonStringEnumMemberName("remote")]
    Remote = 0,

    /// <summary>Part office, part remote.</summary>
    [JsonStringEnumMemberName("hybrid")]
    Hybrid = 1,

    /// <summary>In the office; the position's location says where.</summary>
    [JsonStringEnumMemberName("on-site")]
    OnSite = 2,
}
