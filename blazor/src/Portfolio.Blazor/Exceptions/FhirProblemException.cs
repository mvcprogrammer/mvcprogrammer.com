namespace Portfolio.Blazor.Exceptions;

/// <summary>A FHIR API request that failed: a problem-details answer, a non-JSON body, a timeout, or no connection.</summary>
public sealed class FhirProblemException : Exception
{
    /// <summary>Shown when the function answers 429.</summary>
    public const string RATE_LIMIT_MESSAGE = "That is a lot of requests in a row; wait a moment and try again.";

    /// <summary>Shown when the function answers 502 or 504, the sandbox being slow or down.</summary>
    public const string UPSTREAM_MESSAGE = "The sandbox is slow or down right now. Try again in a moment.";

    /// <summary>Shown when the browser gave up waiting.</summary>
    public const string TIMEOUT_MESSAGE = "The request timed out. Try again in a moment.";

    /// <summary>Shown when the request never reached the function.</summary>
    public const string NETWORK_MESSAGE = "Could not reach the API. Check the connection and try again.";

    /// <summary>Shown when a success status carried something that is not JSON, as a host serving HTML does.</summary>
    public const string NOT_JSON_MESSAGE = "The function answered with something that is not JSON.";

    /// <summary>Creates the exception.</summary>
    /// <param name="message">What to tell the visitor.</param>
    /// <param name="status">HTTP status, 0 when no response arrived.</param>
    /// <param name="title">The problem's title, when the function sent one.</param>
    /// <param name="durationMs">Round trip until the failure.</param>
    /// <param name="xCache">CloudFront's X-Cache header, when present.</param>
    /// <param name="timedOut">True when the browser aborted the request.</param>
    /// <param name="innerException">What the HTTP stack threw, when anything.</param>
    public FhirProblemException(string message, int status, string? title, long durationMs, string? xCache, bool timedOut, Exception? innerException = null)
        : base(message, innerException)
    {
        Status = status;
        Title = title;
        DurationMs = durationMs;
        XCache = xCache;
        TimedOut = timedOut;
    }

    /// <summary>Creates the exception with a default message.</summary>
    public FhirProblemException()
        : this(NETWORK_MESSAGE, 0, null, 0, null, false)
    {
    }

    /// <summary>Creates the exception with a message.</summary>
    /// <param name="message">What to tell the visitor.</param>
    public FhirProblemException(string message)
        : this(message, 0, null, 0, null, false)
    {
    }

    /// <summary>Creates the exception with a message and a cause.</summary>
    /// <param name="message">What to tell the visitor.</param>
    /// <param name="innerException">The cause.</param>
    public FhirProblemException(string message, Exception innerException)
        : this(message, 0, null, 0, null, false, innerException)
    {
    }

    /// <summary>HTTP status, 0 when no response arrived.</summary>
    public int Status { get; }

    /// <summary>The problem's title, when the function sent one.</summary>
    public string? Title { get; }

    /// <summary>Round trip until the failure.</summary>
    public long DurationMs { get; }

    /// <summary>CloudFront's X-Cache header, when present.</summary>
    public string? XCache { get; }

    /// <summary>True when the browser aborted the request.</summary>
    public bool TimedOut { get; }

    /// <summary>True for 502 and 504, when the sandbox rather than the function failed.</summary>
    public bool UpstreamFailed => Status is 502 or 504;

    /// <summary>The error for a response outside 2xx, from its problem body when the function sent one.</summary>
    /// <param name="status">The response status.</param>
    /// <param name="problem">The parsed problem details, or null when the body was not one.</param>
    /// <param name="durationMs">Round trip until the failure.</param>
    /// <param name="xCache">CloudFront's X-Cache header, when present.</param>
    public static FhirProblemException FromResponse(int status, Models.ProblemDetails? problem, long durationMs, string? xCache) =>
        new(problem?.Detail ?? MessageFor(status), status, problem?.Title, durationMs, xCache, false);

    /// <summary>The error for a success status whose body was not JSON.</summary>
    /// <param name="status">The response status.</param>
    /// <param name="durationMs">Round trip so far.</param>
    /// <param name="xCache">CloudFront's X-Cache header, when present.</param>
    public static FhirProblemException NotJson(int status, long durationMs, string? xCache) =>
        new(NOT_JSON_MESSAGE, status, null, durationMs, xCache, false);

    /// <summary>The error for a request the browser aborted after the client's timeout.</summary>
    /// <param name="durationMs">Round trip until the abort.</param>
    /// <param name="cause">The cancellation the HTTP stack threw.</param>
    public static FhirProblemException TimedOutAfter(long durationMs, Exception cause) =>
        new(TIMEOUT_MESSAGE, 0, null, durationMs, null, true, cause);

    /// <summary>The error for a request that never reached the function.</summary>
    /// <param name="durationMs">Round trip until the failure.</param>
    /// <param name="cause">What the HTTP stack threw.</param>
    public static FhirProblemException Unreachable(long durationMs, Exception cause) =>
        new(NETWORK_MESSAGE, 0, null, durationMs, null, false, cause);

    private static string MessageFor(int status) => status switch
    {
        429 => RATE_LIMIT_MESSAGE,
        502 or 504 => UPSTREAM_MESSAGE,
        _ => $"The request failed ({status}).",
    };
}
