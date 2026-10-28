using System.Text;
using System.Text.Json;

namespace Portfolio.Blazor.Serialization;

/// <summary>
/// Re-writes compact JSON with two-space indentation and a newline before each member, the
/// shape <c>JSON.stringify(value, null, 2)</c> produces on the other editions, so the FHIR
/// explorer's "under the hood" panel reads the same everywhere. Works on the text, not the
/// type, so the trimmed WebAssembly build needs no second source-generated context.
/// </summary>
public static class JsonIndenter
{
    #region Fields

    // "\n" regardless of platform so tests and the browser agree; Utf8JsonWriter would otherwise use Environment.NewLine.
    private static readonly JsonWriterOptions INDENTED = new()
    {
        Indented = true,
        NewLine = "\n",
    };

    #endregion

    #region Public Methods

    /// <summary>Returns <paramref name="json"/> indented. Input that is not valid JSON is returned unchanged.</summary>
    /// <param name="json">A JSON document, usually compact.</param>
    /// <returns>The same document with two-space indentation.</returns>
    public static string Indent(string json)
    {
        ArgumentNullException.ThrowIfNull(json);

        try
        {
            using var document = JsonDocument.Parse(json);
            using var buffer = new MemoryStream();
            using (var writer = new Utf8JsonWriter(buffer, INDENTED))
            {
                document.WriteTo(writer);
            }

            return Encoding.UTF8.GetString(buffer.GetBuffer(), 0, (int)buffer.Length);
        }
        catch (JsonException)
        {
            return json;
        }
    }

    #endregion
}
