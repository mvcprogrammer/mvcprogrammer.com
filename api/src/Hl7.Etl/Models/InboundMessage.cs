namespace Hl7.Etl.Models;

/// <summary>A message about to land: what the insert function needs, nothing the table assigns.</summary>
/// <param name="MessageControlId">MSH-10.</param>
/// <param name="MessageType">MSH-9.1.</param>
/// <param name="TriggerEvent">MSH-9.2.</param>
/// <param name="SendingFacility">MSH-4.</param>
/// <param name="ReceivedAt">When it arrived.</param>
/// <param name="RawMessage">The message text.</param>
public sealed record InboundMessage(
    string MessageControlId,
    string MessageType,
    string TriggerEvent,
    string SendingFacility,
    DateTimeOffset ReceivedAt,
    string RawMessage);
