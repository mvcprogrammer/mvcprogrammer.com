using System.Diagnostics;
using Hl7.Etl.Configurations;
using Hl7.Etl.Exceptions;
using Hl7.Etl.Interfaces;
using Hl7.Etl.Mappers;
using Hl7.Etl.Models;
using Hl7.Fhir.Model;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Polly.Timeout;

namespace Hl7.Etl.Services;

/// <summary>
/// The loader: claims a batch, maps each message (a message that cannot be mapped is failed on its
/// own and the batch goes on), posts one transaction bundle, and settles the batch in the landing
/// table: processed with the response bundle's id, or failed with the server's reason so the next
/// run claims it again. Runs until the landing table has nothing pending or the batch cap is hit.
/// A reference to a patient or encounter that is not in the batch is resolved to the server's id
/// by an identifier search first (the public sandbox does not resolve conditional references);
/// a message whose target is not on the server yet is failed alone and retried later.
/// </summary>
public sealed class LoadService
{
    private readonly IMessageRepository _messages;
    private readonly IBundleClient _bundles;
    private readonly EtlOptions _options;
    private readonly ILogger<LoadService> _logger;

    /// <summary>Creates the loader.</summary>
    public LoadService(IMessageRepository messages, IBundleClient bundles, IOptions<EtlOptions> options, ILogger<LoadService> logger)
    {
        ArgumentNullException.ThrowIfNull(messages);
        ArgumentNullException.ThrowIfNull(bundles);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(logger);
        _messages = messages;
        _bundles = bundles;
        _options = options.Value;
        _logger = logger;
    }

    /// <summary>Loads until nothing is pending, or <paramref name="maxBatches"/> batches have been claimed.</summary>
    public async Task<LoadSummary> RunAsync(int batchSize, int maxBatches, CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(batchSize, 1);
        ArgumentOutOfRangeException.ThrowIfLessThan(maxBatches, 1);

        var stopwatch = Stopwatch.StartNew();
        int batches = 0, messages = 0, mapped = 0, mappingFailures = 0, created = 0, present = 0, failedBatches = 0;
        while (batches < maxBatches)
        {
            var batch = await _messages.ClaimAsync(batchSize, TimeSpan.FromMinutes(_options.StaleClaimMinutes), cancellationToken);
            if (batch.Count == 0)
            {
                break;
            }

            batches++;
            messages += batch.Count;
            var (mappedBatch, failures) = MapBatch(batch);
            foreach (var (message, error) in failures)
            {
                await _messages.FailAsync([message.MessageId], error, cancellationToken);
            }

            mappingFailures += failures.Count;
            var ids = mappedBatch.Select(item => item.Message.MessageId).ToArray();
            try
            {
                var (ready, unresolved) = await ResolveReferencesAsync(mappedBatch, cancellationToken);
                mapped += ready.Count;
                mappingFailures += unresolved.Count;
                foreach (var (message, error) in unresolved)
                {
                    await _messages.FailAsync([message.MessageId], error, cancellationToken);
                }

                if (ready.Count == 0)
                {
                    continue;
                }

                ids = ready.Select(item => item.Message.MessageId).ToArray();
                var outcome = await _bundles.PostTransactionAsync(BundleBuilder.Build(ready, _options.IdentifierSystem), cancellationToken);
                await _messages.CompleteAsync(ids, outcome.BundleId, cancellationToken);
                created += outcome.Created;
                present += outcome.AlreadyPresent;
                _logger.LogInformation("Batch {Batch}: {Messages} messages, {Resources} resources, {Created} created, {Present} already present (bundle {BundleId})", batches, ready.Count, ready.Sum(item => item.Resources.Count), outcome.Created, outcome.AlreadyPresent, outcome.BundleId);
            }
            catch (Exception ex) when (ex is BundleRejectedException or HttpRequestException or TaskCanceledException or TimeoutRejectedException && !cancellationToken.IsCancellationRequested)
            {
                failedBatches++;
                var reason = ex is TaskCanceledException or TimeoutRejectedException ? "The server did not answer within the budget." : ex.Message;
                await _messages.FailAsync(ids, reason, cancellationToken);
                _logger.LogWarning(ex, "Batch {Batch} failed; its {Messages} messages will be retried: {Reason}", batches, ids.Length, reason);
            }
        }

        return new LoadSummary(batches, messages, mapped, mappingFailures, created, present, failedBatches, stopwatch.Elapsed);
    }

    /// <summary>
    /// Resolves every conditional reference whose target is not in the batch to the server's id, looking each
    /// identifier up once per batch. A message with a target the server does not have yet is set aside.
    /// </summary>
    private async Task<(IReadOnlyList<(LandedMessage Message, IReadOnlyList<Resource> Resources)> Ready, IReadOnlyList<(LandedMessage Message, string Error)> Unresolved)> ResolveReferencesAsync(
        IReadOnlyList<(LandedMessage Message, IReadOnlyList<Resource> Resources)> batch,
        CancellationToken cancellationToken)
    {
        var inBatch = new HashSet<string>(batch.SelectMany(item => item.Resources).Select(resource => EtlIdentifiers.ConditionalReference(resource.TypeName, _options.IdentifierSystem, BundleBuilder.IdentifierOf(resource, _options.IdentifierSystem).Value!)), StringComparer.Ordinal);
        var resolved = new Dictionary<string, string?>(StringComparer.Ordinal);
        var ready = new List<(LandedMessage, IReadOnlyList<Resource>)>(batch.Count);
        var unresolved = new List<(LandedMessage, string)>();
        foreach (var (message, resources) in batch)
        {
            string? missing = null;
            foreach (var reference in resources.SelectMany(BundleBuilder.ReferencesOf))
            {
                var conditional = reference.Reference;
                // Already resolved (a message's observations share one subject reference), in the batch, or not conditional: nothing to look up.
                if (conditional is null || !conditional.Contains('?', StringComparison.Ordinal) || inBatch.Contains(conditional))
                {
                    continue;
                }

                if (!resolved.TryGetValue(conditional, out var id))
                {
                    var (resourceType, token) = Split(conditional);
                    id = await _bundles.FindIdAsync(resourceType, token, cancellationToken);
                    resolved[conditional] = id;
                }

                if (id is null)
                {
                    missing = conditional;
                    break;
                }

                reference.Reference = $"{Split(conditional).ResourceType}/{id}";
            }

            if (missing is null)
            {
                ready.Add((message, resources));
            }
            else
            {
                var (resourceType, token) = Split(missing);
                unresolved.Add((message, $"{message.MessageControlId}: references {resourceType} {token}, which the server does not have yet."));
                _logger.LogWarning("Message {ControlId} references {ResourceType} {Token}, which the server does not have yet; it will be retried", message.MessageControlId, resourceType, token);
            }
        }

        return (ready, unresolved);
    }

    /// <summary>A conditional reference, <c>Type?identifier=token</c>, split into its type and the decoded token.</summary>
    private static (string ResourceType, string Token) Split(string conditional)
    {
        var question = conditional.IndexOf('?', StringComparison.Ordinal);
        var equals = conditional.IndexOf('=', StringComparison.Ordinal);
        return (conditional[..question], Uri.UnescapeDataString(conditional[(equals + 1)..]));
    }

    /// <summary>Maps every message of the batch, keeping the ones that mapped and the reason for each that did not.</summary>
    private (IReadOnlyList<(LandedMessage Message, IReadOnlyList<Resource> Resources)> Ready, IReadOnlyList<(LandedMessage Message, string Error)> Failures) MapBatch(IReadOnlyList<LandedMessage> batch)
    {
        var ready = new List<(LandedMessage, IReadOnlyList<Resource>)>(batch.Count);
        var failures = new List<(LandedMessage, string)>();
        foreach (var message in batch)
        {
            try
            {
                ready.Add((message, MessageMapper.Map(message, _options.IdentifierSystem)));
            }
            catch (Hl7MappingException ex)
            {
                failures.Add((message, ex.Message));
                _logger.LogWarning("Message {ControlId} cannot be mapped: {Location}: {Reason}", ex.MessageControlId, ex.Location, ex.Reason);
            }
        }

        return (ready, failures);
    }
}
