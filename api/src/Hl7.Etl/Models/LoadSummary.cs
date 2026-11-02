namespace Hl7.Etl.Models;

/// <summary>What one <c>load</c> run did, for the run log.</summary>
/// <param name="Batches">Batches claimed.</param>
/// <param name="Messages">Messages claimed across them.</param>
/// <param name="Mapped">Messages that became resources.</param>
/// <param name="MappingFailures">Messages that could not be mapped (recorded against their rows).</param>
/// <param name="Created">Resources the server created.</param>
/// <param name="AlreadyPresent">Resources the server already had (a conditional create matched).</param>
/// <param name="FailedBatches">Batches the server rejected or that did not answer (their messages are retried next run).</param>
/// <param name="Elapsed">Wall time of the run.</param>
public sealed record LoadSummary(int Batches, int Messages, int Mapped, int MappingFailures, int Created, int AlreadyPresent, int FailedBatches, TimeSpan Elapsed);
