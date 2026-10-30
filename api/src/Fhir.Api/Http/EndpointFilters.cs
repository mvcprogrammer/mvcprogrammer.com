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

/// <summary>Answers 429 with Retry-After once an address has used its write budget, which is separate from, and smaller than, the read budget.</summary>
public sealed class WriteRateLimitFilter([FromKeyedServices(WriteRateLimitFilter.LIMITER_KEY)] RateLimiter limiter) : IEndpointFilter
{
    /// <summary>The DI key of the write limiter.</summary>
    public const string LIMITER_KEY = "write";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);

        var http = context.HttpContext;
        if (!limiter.TryAcquire(ClientAddress.Of(http), out var retryAfter))
        {
            return Problems.RateLimited(
                http,
                $"This address has made {limiter.Budget} writes in the last {(int)limiter.Window.TotalMinutes} minutes. Try again in {retryAfter} seconds.",
                retryAfter);
        }

        return await next(context);
    }
}

/// <summary>Turns the write exceptions into the problem responses promised in openapi.yaml. Sits inside <see cref="UpstreamProblemFilter"/>, which handles the upstream ones.</summary>
public sealed class WriteProblemFilter(IOptions<FhirOptions> options) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);

        try
        {
            return await next(context);
        }
        catch (PatientValidationException ex)
        {
            return Problems.ValidationFailed(context.HttpContext, ex.Errors);
        }
        catch (DemoPatientReadOnlyException ex)
        {
            return Problems.ReadOnly(context.HttpContext, "Demo patient is read-only", ex.Message);
        }
        catch (WritablePatientNotFoundException ex)
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return Problems.NotFound(context.HttpContext, "Patient not found", ex.Message);
        }
        catch (PatchConflictException ex)
        {
            return Problems.Conflict(context.HttpContext, "Patch not applied", ex.Message);
        }
        catch (SessionCapExceededException ex)
        {
            return Problems.RateLimited(context.HttpContext, ex.Message, options.Value.RateLimitWindowSeconds);
        }
        catch (ConditionRejectedException ex)
        {
            return Problems.Unprocessable(context.HttpContext, "condition-rejected", "Condition rejected", ex.Message);
        }
    }
}
