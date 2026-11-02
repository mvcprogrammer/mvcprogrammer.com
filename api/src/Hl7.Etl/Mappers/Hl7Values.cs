using System.Globalization;
using Efferent.HL7.V2;
using Hl7.Etl.Exceptions;

namespace Hl7.Etl.Mappers;

/// <summary>Reads HL7 v2 fields and components with the HL7-V2 library and turns them into typed values, naming the location on every failure.</summary>
public static class Hl7Values
{
    private const string DTM_FORMAT = "yyyyMMddHHmmss";
    private const string DATE_FORMAT = "yyyyMMdd";

    /// <summary>Parses the raw text, or explains why it is not an HL7 v2 message.</summary>
    public static Message Parse(string controlId, string raw)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(controlId);
        ArgumentNullException.ThrowIfNull(raw);

        var message = new Message(raw);
        try
        {
            if (!message.ParseMessage())
            {
                throw new Hl7MappingException(controlId, "MSH", "The text is not an HL7 v2 message.");
            }
        }
        catch (HL7Exception ex)
        {
            throw new Hl7MappingException(controlId, "MSH", ex.Message);
        }

        return message;
    }

    /// <summary>The first segment of a type, or a mapping error naming it when the message has none.</summary>
    public static Segment Required(Message message, string controlId, string segmentName)
    {
        ArgumentNullException.ThrowIfNull(message);
        var segments = message.Segments(segmentName);
        if (segments is null || segments.Count == 0)
        {
            throw new Hl7MappingException(controlId, segmentName, $"The message has no {segmentName} segment.");
        }

        return segments[0];
    }

    /// <summary>A field's value, or an empty string when the segment does not reach it.</summary>
    public static string Field(Segment segment, int field)
    {
        ArgumentNullException.ThrowIfNull(segment);
        try
        {
            return segment.Fields(field)?.Value ?? string.Empty;
        }
        catch (HL7Exception)
        {
            return string.Empty;
        }
    }

    /// <summary>A component's value, or an empty string when the field does not reach it (a plain field counts as its first component).</summary>
    public static string Component(Segment segment, int field, int component)
    {
        ArgumentNullException.ThrowIfNull(segment);
        try
        {
            var value = segment.Fields(field);
            if (value is null)
            {
                return string.Empty;
            }

            if (!value.IsComponentized)
            {
                return component == 1 ? value.Value ?? string.Empty : string.Empty;
            }

            return value.Components(component)?.Value ?? string.Empty;
        }
        catch (HL7Exception)
        {
            return string.Empty;
        }
    }

    /// <summary>A field or component that must be present.</summary>
    public static string RequiredText(string controlId, string location, string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new Hl7MappingException(controlId, location, "Required and empty.");
        }

        return value.Trim();
    }

    /// <summary>An HL7 DTM (yyyyMMddHHmmss, UTC in this feed) as an instant.</summary>
    public static DateTimeOffset Instant(string controlId, string location, string value)
    {
        if (DateTime.TryParseExact(value, DTM_FORMAT, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var parsed))
        {
            return new DateTimeOffset(parsed, TimeSpan.Zero);
        }

        throw new Hl7MappingException(controlId, location, $"'{value}' is not a timestamp in yyyyMMddHHmmss form.");
    }

    /// <summary>An HL7 date (yyyyMMdd) as a date.</summary>
    public static DateOnly Date(string controlId, string location, string value)
    {
        if (DateOnly.TryParseExact(value, DATE_FORMAT, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            return parsed;
        }

        throw new Hl7MappingException(controlId, location, $"'{value}' is not a date in yyyyMMdd form.");
    }

    /// <summary>A numeric OBX value.</summary>
    public static decimal Number(string controlId, string location, string value)
    {
        if (decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
        {
            return parsed;
        }

        throw new Hl7MappingException(controlId, location, $"'{value}' is not a number.");
    }
}
