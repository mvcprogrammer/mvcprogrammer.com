namespace Hl7.Etl.Models;

/// <summary>The server's answer to one transaction bundle, counted.</summary>
/// <param name="BundleId">The id of the response bundle, kept against the rows it settled.</param>
/// <param name="Created">Entries answered 201.</param>
/// <param name="AlreadyPresent">Entries answered 200: the conditional create matched an existing resource.</param>
public sealed record BatchOutcome(string BundleId, int Created, int AlreadyPresent);
