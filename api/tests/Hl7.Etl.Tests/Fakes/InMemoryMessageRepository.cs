using Hl7.Etl.Interfaces;
using Hl7.Etl.Models;

namespace Hl7.Etl.Tests.Fakes;

/// <summary>The landing table in memory, with the calls the loader makes recorded, for the loader tests.</summary>
public sealed class InMemoryMessageRepository : IMessageRepository
{
    private readonly Queue<IReadOnlyList<LandedMessage>> _batches = new();

    /// <summary>(message ids, bundle id) of every CompleteAsync call.</summary>
    public List<(long[] Ids, string BundleId)> Completed { get; } = [];

    /// <summary>(message ids, error) of every FailAsync call.</summary>
    public List<(long[] Ids, string Error)> Failed { get; } = [];

    /// <summary>The batch sizes asked for, in order.</summary>
    public List<int> Claims { get; } = [];

    /// <summary>The id the fake server answers for a (resource type, identifier token) lookup; absent means not found.</summary>
    public Dictionary<(string Type, string Token), string> Known { get; } = [];

    /// <summary>Queues a batch for the next claim; an empty queue claims nothing.</summary>
    public InMemoryMessageRepository WithBatch(params LandedMessage[] batch)
    {
        _batches.Enqueue(batch);
        return this;
    }

    public Task<long?> InsertAsync(InboundMessage message, CancellationToken cancellationToken) => throw new NotSupportedException();

    public Task<IReadOnlyList<LandedMessage>> ClaimAsync(int batchSize, TimeSpan staleAfter, CancellationToken cancellationToken)
    {
        Claims.Add(batchSize);
        return Task.FromResult(_batches.Count == 0 ? [] : _batches.Dequeue());
    }

    public Task<int> CompleteAsync(IReadOnlyList<long> messageIds, string fhirBundleId, CancellationToken cancellationToken)
    {
        Completed.Add((messageIds.ToArray(), fhirBundleId));
        return Task.FromResult(messageIds.Count);
    }

    public Task<int> FailAsync(IReadOnlyList<long> messageIds, string error, CancellationToken cancellationToken)
    {
        Failed.Add((messageIds.ToArray(), error));
        return Task.FromResult(messageIds.Count);
    }

    public Task<LandingStatus> StatusAsync(CancellationToken cancellationToken) => throw new NotSupportedException();

    public Task<int> RequeueAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
}
