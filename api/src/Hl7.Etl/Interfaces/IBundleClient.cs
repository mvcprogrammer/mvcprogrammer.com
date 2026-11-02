using Hl7.Etl.Models;
using Hl7.Fhir.Model;

namespace Hl7.Etl.Interfaces;

/// <summary>Posts a transaction bundle to the FHIR server and counts the answer.</summary>
public interface IBundleClient
{
    /// <summary>Posts the bundle. Throws <see cref="Exceptions.BundleRejectedException"/> on a non-2xx answer; a timeout or network failure surfaces as the HTTP exception.</summary>
    Task<BatchOutcome> PostTransactionAsync(Bundle bundle, CancellationToken cancellationToken);

    /// <summary>The server id of the one resource of the type carrying the identifier token (<c>system|value</c>), or null when there is none.</summary>
    Task<string?> FindIdAsync(string resourceType, string identifierToken, CancellationToken cancellationToken);
}
