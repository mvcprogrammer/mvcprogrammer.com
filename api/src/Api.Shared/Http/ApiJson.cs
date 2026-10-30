using System.Text.Json;
using System.Text.Json.Serialization;

namespace Api.Shared.Http;

/// <summary>The one JSON configuration used by the endpoints, the seed tool, and the tests.</summary>
public static class ApiJson
{
    public static JsonSerializerOptions Options { get; } = Apply(new JsonSerializerOptions(JsonSerializerDefaults.Web));

    public static JsonSerializerOptions Apply(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower));
        options.WriteIndented = false;
        return options;
    }
}
