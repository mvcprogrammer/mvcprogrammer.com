using Hl7.Etl.Exceptions;
using Hl7.Etl.Models;
using Hl7.Fhir.Model;

namespace Hl7.Etl.Mappers;

/// <summary>The one entry point: a landed message to the FHIR resources it carries, by message type and trigger event.</summary>
public static class MessageMapper
{
    /// <summary>The resources of the message, in the order a bundle should carry them (patient first).</summary>
    public static IReadOnlyList<Resource> Map(LandedMessage landed, Uri identifierSystem)
    {
        ArgumentNullException.ThrowIfNull(landed);
        ArgumentNullException.ThrowIfNull(identifierSystem);

        return (landed.MessageType.ToUpperInvariant(), landed.TriggerEvent.ToUpperInvariant()) switch
        {
            ("ADT", "A01") => AdmissionMapper.Map(landed, identifierSystem),
            ("ORU", "R01") => ResultMapper.Map(landed, identifierSystem),
            var (type, trigger) => throw new Hl7MappingException(landed.MessageControlId, "MSH.9", $"{type}^{trigger} is not a message this ETL maps (ADT^A01, ORU^R01)."),
        };
    }
}
