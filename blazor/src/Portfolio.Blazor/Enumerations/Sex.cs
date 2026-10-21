using System.Text.Json.Serialization;

namespace Portfolio.Blazor.Enumerations;

/// <summary>FHIR <c>Patient.gender</c> (AdministrativeGender), passed through unchanged by the FHIR API.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<Sex>))]
public enum Sex
{
    /// <summary>Male.</summary>
    [JsonStringEnumMemberName("male")]
    Male = 0,

    /// <summary>Female.</summary>
    [JsonStringEnumMemberName("female")]
    Female = 1,

    /// <summary>Other.</summary>
    [JsonStringEnumMemberName("other")]
    Other = 2,

    /// <summary>Unknown.</summary>
    [JsonStringEnumMemberName("unknown")]
    Unknown = 3,
}
