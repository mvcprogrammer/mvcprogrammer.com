using System.Net.Http;
using Portfolio.Blazor.Exceptions;
using Portfolio.Blazor.Models;

namespace Portfolio.Blazor.Tests.Exceptions;

/// <summary>Tests for <see cref="FhirProblemException"/>.</summary>
public sealed class FhirProblemExceptionTests
{
    #region Constructor Tests

    /// <summary>The full constructor exposes every fact and the message.</summary>
    [Fact]
    public void FhirProblemException_ShouldExposeFacts()
    {
        // Act
        var exception = new FhirProblemException("Nope.", 429, "Too Many Requests", 12, "Miss from cloudfront", false);

        // Assert
        Assert.Equal("Nope.", exception.Message);
        Assert.Equal(429, exception.Status);
        Assert.Equal("Too Many Requests", exception.Title);
        Assert.Equal(12, exception.DurationMs);
        Assert.Equal("Miss from cloudfront", exception.XCache);
        Assert.False(exception.TimedOut, "not a timeout");
        Assert.False(exception.UpstreamFailed, "429 is the function, not the sandbox");
    }

    /// <summary>The conventional constructors default to a network failure.</summary>
    [Fact]
    public void FhirProblemException_ShouldDefaultToNetworkFailure()
    {
        // Act
        var bare = new FhirProblemException();
        var withMessage = new FhirProblemException("x");
        var withCause = new FhirProblemException("x", new HttpRequestException("boom"));

        // Assert
        Assert.Equal(FhirProblemException.NETWORK_MESSAGE, bare.Message);
        Assert.Equal(0, withMessage.Status);
        Assert.IsType<HttpRequestException>(withCause.InnerException);
    }

    #endregion

    #region UpstreamFailed Tests

    /// <summary>502 and 504 are upstream failures; nothing else is.</summary>
    [Theory]
    [InlineData(502, true)]
    [InlineData(504, true)]
    [InlineData(500, false)]
    [InlineData(0, false)]
    public void UpstreamFailed_ShouldBeTrueFor502And504Only(int status, bool expected)
    {
        // Act and Assert
        Assert.Equal(expected, new FhirProblemException("x", status, null, 0, null, false).UpstreamFailed);
    }

    #endregion

    #region FromResponse Tests

    /// <summary>The problem detail wins over the status message, and the title and cache header are kept.</summary>
    [Fact]
    public void FromResponse_ShouldPreferDetailAndKeepTitle()
    {
        // Act
        var exception = FhirProblemException.FromResponse(400, new ProblemDetails("Bad Request", 400, "family is required"), 20, "Error from cloudfront");

        // Assert
        Assert.Equal("family is required", exception.Message);
        Assert.Equal("Bad Request", exception.Title);
        Assert.Equal(400, exception.Status);
        Assert.Equal("Error from cloudfront", exception.XCache);
    }

    /// <summary>Without a detail the message follows the status.</summary>
    [Theory]
    [InlineData(429, FhirProblemException.RATE_LIMIT_MESSAGE)]
    [InlineData(502, FhirProblemException.UPSTREAM_MESSAGE)]
    [InlineData(504, FhirProblemException.UPSTREAM_MESSAGE)]
    [InlineData(500, "The request failed (500).")]
    public void FromResponse_ShouldUseStatusMessageWithoutDetail(int status, string expected)
    {
        // Act and Assert
        Assert.Equal(expected, FhirProblemException.FromResponse(status, null, 0, null).Message);
    }

    #endregion

    #region Factory Tests

    /// <summary>The three other factories set the message, status, and timed-out flag.</summary>
    [Fact]
    public void Factories_ShouldSetMessageStatusAndFlag()
    {
        // Arrange
        var cause = new TaskCanceledException("slow");

        // Act
        var notJson = FhirProblemException.NotJson(200, 7, null);
        var timedOut = FhirProblemException.TimedOutAfter(32_001, cause);
        var unreachable = FhirProblemException.Unreachable(5, new HttpRequestException("down"));

        // Assert
        Assert.Equal((FhirProblemException.NOT_JSON_MESSAGE, 200, false), (notJson.Message, notJson.Status, notJson.TimedOut));
        Assert.Equal((FhirProblemException.TIMEOUT_MESSAGE, 0, true, 32_001L), (timedOut.Message, timedOut.Status, timedOut.TimedOut, timedOut.DurationMs));
        Assert.Same(cause, timedOut.InnerException);
        Assert.Equal((FhirProblemException.NETWORK_MESSAGE, 0, false), (unreachable.Message, unreachable.Status, unreachable.TimedOut));
    }

    #endregion
}
