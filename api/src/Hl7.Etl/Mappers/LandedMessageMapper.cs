using System.Data.Common;
using Hl7.Etl.Models;

namespace Hl7.Etl.Mappers;

/// <summary>Maps the rows of <c>hl7.messages_claim</c> to <see cref="LandedMessage"/>: ordinals resolved once, typed getters, no reflection.</summary>
public static class LandedMessageMapper
{
    /// <summary>Reads every row of the reader into messages, in reader order.</summary>
    public static async Task<IReadOnlyList<LandedMessage>> ReadAllAsync(DbDataReader reader, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(reader);

        var messageId = reader.GetOrdinal("message_id");
        var controlId = reader.GetOrdinal("message_control_id");
        var messageType = reader.GetOrdinal("message_type");
        var triggerEvent = reader.GetOrdinal("trigger_event");
        var facility = reader.GetOrdinal("sending_facility");
        var receivedAt = reader.GetOrdinal("received_at");
        var raw = reader.GetOrdinal("raw_message");
        var attempts = reader.GetOrdinal("attempt_count");

        var messages = new List<LandedMessage>();
        while (await reader.ReadAsync(cancellationToken))
        {
            messages.Add(new LandedMessage(
                reader.GetInt64(messageId),
                reader.GetString(controlId),
                reader.GetString(messageType),
                reader.GetString(triggerEvent),
                reader.GetString(facility),
                reader.GetFieldValue<DateTime>(receivedAt).ToUniversalTime(),
                reader.GetString(raw),
                reader.GetInt32(attempts)));
        }

        return messages;
    }

    /// <summary>Reads the one row of <c>hl7.messages_status</c>.</summary>
    public static async Task<LandingStatus> ReadStatusAsync(DbDataReader reader, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(reader);

        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new InvalidOperationException("hl7.messages_status returned no row.");
        }

        return new LandingStatus(
            reader.GetInt64(reader.GetOrdinal("pending")),
            reader.GetInt64(reader.GetOrdinal("claimed")),
            reader.GetInt64(reader.GetOrdinal("processed")),
            reader.GetInt64(reader.GetOrdinal("failed")));
    }
}
