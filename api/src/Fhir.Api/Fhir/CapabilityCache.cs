using Fhir.Api.Configuration;
using Fhir.Api.Mapping;
using Fhir.Api.Models;
using Microsoft.Extensions.Options;

namespace Fhir.Api.Fhir;

/// <summary>
/// Reads the sandbox CapabilityStatement on first use and keeps the mapped subset per function
/// instance for <see cref="FhirOptions.CapabilityTtl"/>. Never touched on cold start: a metadata
/// call took 1.7 s against HAPI on 2026-10-16. Concurrent first callers share one read.
/// </summary>
public sealed class CapabilityCache
{
    private readonly IFhirGateway _gateway;
    private readonly FhirOptions _options;
    private readonly TimeProvider _time;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private CapabilitySubset? _cached;
    private DateTimeOffset _expires = DateTimeOffset.MinValue;

    public CapabilityCache(IFhirGateway gateway, IOptions<FhirOptions> options, TimeProvider time)
    {
        ArgumentNullException.ThrowIfNull(gateway);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(time);
        _gateway = gateway;
        _options = options.Value;
        _time = time;
    }

    public async Task<CapabilitySubset> GetAsync(CancellationToken cancellationToken)
    {
        var now = _time.GetUtcNow();
        if (_cached is not null && now < _expires)
        {
            return _cached;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            now = _time.GetUtcNow();
            if (_cached is not null && now < _expires)
            {
                return _cached;
            }

            var trace = new TraceBuilder(new DataSource(_options.SourceName, _options.BaseUrl.ToString()), _options.PageCap);
            var statement = await _gateway.CapabilityStatementAsync(trace, cancellationToken);
            _cached = CapabilityMapper.ToSubset(statement, _options.BaseUrl, now);
            _expires = now + _options.CapabilityTtl;
            return _cached;
        }
        finally
        {
            _gate.Release();
        }
    }
}
