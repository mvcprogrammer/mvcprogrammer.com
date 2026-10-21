using System.Text.Json.Serialization;

namespace Portfolio.Blazor.Enumerations;

/// <summary>A <c>Condition.clinicalStatus</c> code as the sandbox sent it. Active, recurrence, and relapse count as active.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<ClinicalStatus>))]
public enum ClinicalStatus
{
    /// <summary>Active.</summary>
    [JsonStringEnumMemberName("active")]
    Active = 0,

    /// <summary>Recurrence.</summary>
    [JsonStringEnumMemberName("recurrence")]
    Recurrence = 1,

    /// <summary>Relapse.</summary>
    [JsonStringEnumMemberName("relapse")]
    Relapse = 2,

    /// <summary>Inactive.</summary>
    [JsonStringEnumMemberName("inactive")]
    Inactive = 3,

    /// <summary>Remission.</summary>
    [JsonStringEnumMemberName("remission")]
    Remission = 4,

    /// <summary>Resolved.</summary>
    [JsonStringEnumMemberName("resolved")]
    Resolved = 5,

    /// <summary>Unknown.</summary>
    [JsonStringEnumMemberName("unknown")]
    Unknown = 6,
}
