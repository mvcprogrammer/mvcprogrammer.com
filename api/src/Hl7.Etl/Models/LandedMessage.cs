namespace Hl7.Etl.Models;

/// <summary>One row of the landing table as the loader claims it: the message and its bookkeeping.</summary>
/// <param name="MessageId">The landing table's key.</param>
/// <param name="MessageControlId">MSH-10, unique in the landing table.</param>
/// <param name="MessageType">MSH-9.1, for example ADT or ORU.</param>
/// <param name="TriggerEvent">MSH-9.2, for example A01 or R01.</param>
/// <param name="SendingFacility">MSH-4.</param>
/// <param name="ReceivedAt">When the message landed.</param>
/// <param name="RawMessage">The message as received, segments separated by carriage returns.</param>
/// <param name="AttemptCount">How many loader runs have claimed it, this one included.</param>
public sealed record LandedMessage(
    long MessageId,
    string MessageControlId,
    string MessageType,
    string TriggerEvent,
    string SendingFacility,
    DateTimeOffset ReceivedAt,
    string RawMessage,
    int AttemptCount);
