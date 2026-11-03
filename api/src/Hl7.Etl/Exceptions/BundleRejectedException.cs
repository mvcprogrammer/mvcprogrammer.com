using System.Net;

namespace Hl7.Etl.Exceptions;

/// <summary>The FHIR server did not take a transaction bundle: the status it answered and what its OperationOutcome said.</summary>
public sealed class BundleRejectedException : Exception
{
    /// <summary>Creates the exception.</summary>
    public BundleRejectedException(HttpStatusCode status, string detail)
        : base($"The server answered {(int)status} {status}: {detail}")
    {
        Status = status;
        Detail = detail;
    }

    /// <summary>The HTTP status the server answered.</summary>
    // Carried for callers and logs; nothing inside the ETL reads it.
    // ReSharper disable once UnusedAutoPropertyAccessor.Global
    public HttpStatusCode Status { get; }

    /// <summary>The first OperationOutcome issue, or the body when there was none.</summary>
    // ReSharper disable once UnusedAutoPropertyAccessor.Global
    public string Detail { get; }
}
