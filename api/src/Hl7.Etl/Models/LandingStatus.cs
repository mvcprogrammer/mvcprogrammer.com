namespace Hl7.Etl.Models;

/// <summary>The landing table at a glance.</summary>
/// <param name="Pending">Unprocessed and unclaimed.</param>
/// <param name="Claimed">Held by a run in progress (or abandoned by one that died).</param>
/// <param name="Processed">Loaded into the FHIR server.</param>
/// <param name="Failed">Unprocessed with an error from the last attempt; counted in Pending too.</param>
public sealed record LandingStatus(long Pending, long Claimed, long Processed, long Failed);
