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
    private readonly int _budget;
    private readonly TimeSpan _window;
    private readonly TimeProvider _time;

    /// <summary>The read limiter: the options' request budget and window.</summary>
    public RateLimiter(IOptions<FhirOptions> options, TimeProvider time)
        : this(budget: Value(options).RateLimitBudget, window: Value(options).RateLimitWindow, time)
    {
    }

    /// <summary>A limiter with its own budget over the given window; the write limiter is built this way.</summary>
    public RateLimiter(int budget, TimeSpan window, TimeProvider time)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(budget, 1);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(window, TimeSpan.Zero);
        ArgumentNullException.ThrowIfNull(time);
        _budget = budget;
        _window = window;
        _time = time;
    }

    /// <summary>The budget this limiter enforces, for the problem detail.</summary>
    public int Budget => _budget;

    /// <summary>The window this limiter enforces, for the problem detail.</summary>
    public TimeSpan Window => _window;

    /// <summary>Records the request and says whether it is within budget. When it is not, <paramref name="retryAfterSeconds"/> is how long until the oldest stamp leaves the window.</summary>
    public bool TryAcquire(string address, out int retryAfterSeconds)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(address);

        var now = _time.GetUtcNow().ToUnixTimeMilliseconds();
        var windowMs = (long)_window.TotalMilliseconds;
        var queue = _stamps.GetOrAdd(address, _ => new Queue<long>());
        lock (queue)
        {
            while (queue.Count > 0 && now - queue.Peek() >= windowMs)
            {
                queue.Dequeue();
            }

            if (queue.Count >= _budget)
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

    private static FhirOptions Value(IOptions<FhirOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        return options.Value;
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
