using Fhir.Api.Configuration;
using Fhir.Api.Http;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace Fhir.Api.Tests.Http;

public sealed class RateLimiterTests
{
    private static readonly DateTimeOffset START = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Allows_the_budget_then_refuses_with_time_until_the_window_frees()
    {
        var clock = new FakeTimeProvider(START);
        var limiter = Create(clock, budget: 3, windowSeconds: 600);

        Assert.True(limiter.TryAcquire("203.0.113.7", out _));
        clock.Advance(TimeSpan.FromSeconds(100));
        Assert.True(limiter.TryAcquire("203.0.113.7", out _));
        Assert.True(limiter.TryAcquire("203.0.113.7", out _));

        Assert.False(limiter.TryAcquire("203.0.113.7", out var retryAfter));
        // The oldest stamp is 100 s old in a 600 s window.
        Assert.Equal(500, retryAfter);
    }

    [Fact]
    public void Frees_the_budget_as_stamps_leave_the_window()
    {
        var clock = new FakeTimeProvider(START);
        var limiter = Create(clock, budget: 1, windowSeconds: 60);

        Assert.True(limiter.TryAcquire("a", out _));
        Assert.False(limiter.TryAcquire("a", out _));

        clock.Advance(TimeSpan.FromSeconds(60));

        Assert.True(limiter.TryAcquire("a", out _));
    }

    [Fact]
    public void Budgets_are_per_address()
    {
        var limiter = Create(new FakeTimeProvider(START), budget: 1, windowSeconds: 60);

        Assert.True(limiter.TryAcquire("a", out _));
        Assert.True(limiter.TryAcquire("b", out _));
        Assert.False(limiter.TryAcquire("a", out _));
    }

    [Fact]
    public void Rejects_a_blank_address()
    {
        var limiter = Create(new FakeTimeProvider(START), budget: 1, windowSeconds: 60);

        Assert.Throws<ArgumentException>(() => limiter.TryAcquire(" ", out _));
    }

    private static RateLimiter Create(TimeProvider clock, int budget, int windowSeconds) =>
        new(Options.Create(new FhirOptions { RateLimitBudget = budget, RateLimitWindowSeconds = windowSeconds }), clock);
}
