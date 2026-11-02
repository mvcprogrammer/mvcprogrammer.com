using Hl7.Etl.Models;

namespace Hl7.Etl.Interfaces;

/// <summary>The landing table, through its functions. One connection per call; no SQL text in the application.</summary>
public interface IMessageRepository
{
    /// <summary>Lands one message. Returns its new id, or null when a message with the same control id had already landed.</summary>
    Task<long?> InsertAsync(InboundMessage message, CancellationToken cancellationToken);

    /// <summary>Claims up to <paramref name="batchSize"/> pending messages in arrival order for this run.</summary>
    Task<IReadOnlyList<LandedMessage>> ClaimAsync(int batchSize, TimeSpan staleAfter, CancellationToken cancellationToken);

    /// <summary>Marks a batch processed with the FHIR server's id for the transaction response. Returns the rows updated.</summary>
    Task<int> CompleteAsync(IReadOnlyList<long> messageIds, string fhirBundleId, CancellationToken cancellationToken);

    /// <summary>Marks a batch failed with the reason and releases the claim. Returns the rows updated.</summary>
    Task<int> FailAsync(IReadOnlyList<long> messageIds, string error, CancellationToken cancellationToken);

    /// <summary>The counts of the landing table.</summary>
    Task<LandingStatus> StatusAsync(CancellationToken cancellationToken);
}
