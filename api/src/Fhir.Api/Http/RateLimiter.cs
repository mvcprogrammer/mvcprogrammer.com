using System.Collections.Concurrent;
using Fhir.Api.Configuration;
using Microsoft.Extensions.Options;

namespace Fhir.Api.Http;

/// <summary>
/// A per-IP budget per warm instance, the same shape as the contact form's: a window of
/// timestamps per address, nothing stored anywhere. CloudFront caching keeps most repeat
/// requests off the function; this guards the third-party sandbox from the rest.
/// </summary>
public sealed class RateLimiter
{
    /// <summary>Addresses tracked before the oldest idle ones are dropped; bounds memory on a long-lived instance.</summary>
    private const int MAX_TRACKED_ADDRESSES = 10_000;

    private readonly ConcurrentDictionary<string, Queue<long>> _stamps = new(StringComparer.Ordinal);
    private readonly FhirOptions _options;
    private readonly TimeProvider _time;

    public RateLimiter(IOptions<FhirOptions> options, TimeProvider time)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(time);
        _options = options.Value;
        _time = time;
    }

    /// <summary>Records the request and says whether it is within budget. When it is not, <paramref name="retryAfterSeconds"/> is how long until the oldest stamp leaves the window.</summary>
    public bool TryAcquire(string address, out int retryAfterSeconds)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(address);

        var now = _time.GetUtcNow().ToUnixTimeMilliseconds();
        var windowMs = (long)_options.RateLimitWindow.TotalMilliseconds;
        var queue = _stamps.GetOrAdd(address, _ => new Queue<long>());
        lock (queue)
        {
            while (queue.Count > 0 && now - queue.Peek() >= windowMs)
            {
                queue.Dequeue();
            }

            if (queue.Count >= _options.RateLimitBudget)
            {
                retryAfterSeconds = (int)Math.Max(1, Math.Ceiling((windowMs - (now - queue.Peek())) / 1000.0));
                return false;
            }

            queue.Enqueue(now);
        }

        if (_stamps.Count > MAX_TRACKED_ADDRESSES)
        {
            Prune(now, windowMs);
        }

        retryAfterSeconds = 0;
        return true;
    }

    private void Prune(long now, long windowMs)
    {
        foreach (var (address, queue) in _stamps)
        {
            lock (queue)
            {
                if (queue.Count == 0 || now - queue.Last() >= windowMs)
                {
                    _stamps.TryRemove(address, out _);
                }
            }
        }
    }
}
