using Api.Shared.Http;
using Fhir.Api.Configuration;
using Fhir.Api.Fhir;
using Microsoft.Extensions.Options;

namespace Fhir.Api.Http;

/// <summary>Where the viewer's address comes from behind CloudFront.</summary>
public static class ClientAddress
{
    /// <summary>
    /// CloudFront forwards the viewer in X-Forwarded-For (first hop); the connection itself is
    /// CloudFront's. Locally there is no header, so the socket address is used.
    /// </summary>
    public static string Of(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            var first = forwarded.Split(',', 2)[0].Trim();
            if (first.Length > 0)
            {
                return first;
            }
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}

/// <summary>Answers 429 with Retry-After once an address has used its budget.</summary>
public sealed class RateLimitFilter(RateLimiter limiter, IOptions<FhirOptions> options) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);

        var http = context.HttpContext;
        if (!limiter.TryAcquire(ClientAddress.Of(http), out var retryAfter))
        {
            var o = options.Value;
            return Problems.RateLimited(
                http,
                $"This address has made {o.RateLimitBudget} requests in the last {o.RateLimitWindowSeconds / 60} minutes. Try again in {retryAfter} seconds.",
                retryAfter);
        }

        return await next(context);
    }
}

/// <summary>Turns the three upstream exceptions into the problem responses promised in openapi.yaml. Anything else reaches the exception handler as a 500.</summary>
public sealed class UpstreamProblemFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);

        try
        {
            return await next(context);
        }
        catch (UpstreamNotFoundException ex)
        {
            return Problems.NotFound(context.HttpContext, $"{ex.ResourceType} not found", ex.Message);
        }
        catch (UpstreamTimeoutException ex)
        {
            return Problems.UpstreamTimeout(context.HttpContext, "FHIR sandbox timed out", ex.Message);
        }
        catch (UpstreamUnavailableException ex)
        {
            return Problems.UpstreamUnavailable(context.HttpContext, "FHIR sandbox unavailable", ex.Message);
        }
    }
}
