namespace Hl7.Etl.Exceptions;

/// <summary>A landed message that cannot become FHIR: which message, where in it, and why. The loader records the reason against the row and moves on.</summary>
public sealed class Hl7MappingException : Exception
{
    /// <summary>Creates the exception.</summary>
    /// <param name="messageControlId">MSH-10 of the message that failed.</param>
    /// <param name="location">The segment or field the problem is in, for example <c>PID.7</c>.</param>
    /// <param name="reason">What is wrong with it.</param>
    public Hl7MappingException(string messageControlId, string location, string reason)
        : base($"{messageControlId}: {location}: {reason}")
    {
        MessageControlId = messageControlId;
        Location = location;
        Reason = reason;
    }

    /// <summary>MSH-10 of the message that failed.</summary>
    public string MessageControlId { get; }

    /// <summary>The segment or field the problem is in.</summary>
    public string Location { get; }

    /// <summary>What is wrong with it.</summary>
    public string Reason { get; }
}
