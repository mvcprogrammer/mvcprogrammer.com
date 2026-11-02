using Hl7.Etl.Generators;
using Hl7.Etl.Interfaces;
using Microsoft.Extensions.Logging;

namespace Hl7.Etl.Services;

/// <summary>Lands a synthetic cohort: generates its messages and inserts each through the landing function.</summary>
public sealed class GenerateService
{
    private readonly IMessageRepository _messages;
    private readonly ILogger<GenerateService> _logger;

    /// <summary>Creates the service.</summary>
    public GenerateService(IMessageRepository messages, ILogger<GenerateService> logger)
    {
        ArgumentNullException.ThrowIfNull(messages);
        ArgumentNullException.ThrowIfNull(logger);
        _messages = messages;
        _logger = logger;
    }

    /// <summary>Generates and lands the cohort. Returns how many messages were new and how many had already landed.</summary>
    public async Task<(int Landed, int AlreadyLanded)> RunAsync(int patientCount, int seed, CancellationToken cancellationToken)
    {
        var generated = new SyntheticCohortGenerator(seed).Messages(patientCount);
        var landed = 0;
        var duplicates = 0;
        foreach (var message in generated)
        {
            if (await _messages.InsertAsync(message, cancellationToken) is null)
            {
                duplicates++;
            }
            else
            {
                landed++;
            }
        }

        _logger.LogInformation("Generated {Generated} messages for {Patients} patients (seed {Seed}): {Landed} landed, {Duplicates} had already landed", generated.Count, patientCount, seed, landed, duplicates);
        return (landed, duplicates);
    }
}
