using Fhir.Api.Configuration;
using Fhir.Api.Fhir;
using Fhir.Api.Mapping;
using Fhir.Api.Models;
using Hl7.Fhir.Model;
using Hl7.Fhir.Rest;
using Microsoft.Extensions.Options;
using Task = System.Threading.Tasks.Task;

namespace Fhir.Api.Services;

/// <summary>
/// Orchestrates the gateway calls and maps the resources. A summary reads the Patient first (so a
/// missing patient fails fast with 404), then runs the four bounded searches concurrently:
/// Condition, vital-signs Observation, and _summary=count for Encounter and Observation.
/// </summary>
public sealed class PatientExplorerService : IPatientExplorerService
{
    private const string VITAL_SIGNS_CATEGORY = "vital-signs";

    private readonly IFhirGateway _gateway;
    private readonly FhirOptions _options;
    private readonly TimeProvider _time;

    public PatientExplorerService(IFhirGateway gateway, IOptions<FhirOptions> options, TimeProvider time)
    {
        ArgumentNullException.ThrowIfNull(gateway);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(time);
        _gateway = gateway;
        _options = options.Value;
        _time = time;
    }

    public async Task<PatientSearchResult> SearchAsync(string family, string? birthdate, string? identifier, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(family);

        var query = new SearchParams().Add("family", family);
        if (birthdate is not null)
        {
            query.Add("birthdate", birthdate);
        }

        if (identifier is not null)
        {
            query.Add("identifier", identifier);
        }

        query.LimitTo(_options.SearchPageSize);

        var trace = NewTrace();
        var result = await _gateway.SearchAsync<Patient>(query, pageCap: 1, trace, cancellationToken);
        var items = result.Resources.Select(PatientMapper.ToListItem).ToArray();
        return new PatientSearchResult(items.Length, result.Total, new SearchQuery(family, birthdate, identifier), items, trace.Build());
    }

    public async Task<PatientSummary> SummaryAsync(string patientId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);

        var trace = NewTrace();
        var patient = await _gateway.ReadAsync<Patient>(patientId, trace, cancellationToken);

        var conditionsTask = _gateway.SearchAsync<Condition>(ConditionQuery(patientId), _options.PageCap, trace, cancellationToken);
        var vitalsTask = _gateway.SearchAsync<Observation>(VitalsQuery(patientId), _options.PageCap, trace, cancellationToken);
        var encountersTask = _gateway.CountAsync<Encounter>(PatientQuery(patientId), trace, cancellationToken);
        var observationsTask = _gateway.CountAsync<Observation>(PatientQuery(patientId), trace, cancellationToken);
        await Task.WhenAll(conditionsTask, vitalsTask, encountersTask, observationsTask);

        var conditions = conditionsTask.Result;
        var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);
        return new PatientSummary(
            PatientMapper.ToDemographics(patient, today),
            new ResourceCounts(conditions.Total ?? conditions.Resources.Count, encountersTask.Result, observationsTask.Result),
            ConditionMapper.Split(conditions.Resources),
            VitalSignMapper.Select(vitalsTask.Result.Resources, _options.MaxVitals),
            trace.Build());
    }

    public async Task<Bundle> RawAsync(string patientId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(patientId);

        var trace = NewTrace();
        var patient = await _gateway.ReadAsync<Patient>(patientId, trace, cancellationToken);
        var conditionsTask = _gateway.SearchAsync<Condition>(ConditionQuery(patientId), _options.PageCap, trace, cancellationToken);
        var vitalsTask = _gateway.SearchAsync<Observation>(VitalsQuery(patientId), _options.PageCap, trace, cancellationToken);
        await Task.WhenAll(conditionsTask, vitalsTask);

        var baseUrl = _options.BaseUrl.ToString().TrimEnd('/');
        var bundle = new Bundle { Type = Bundle.BundleType.Collection };
        bundle.Entry.Add(Entry(baseUrl, patient));
        foreach (var condition in conditionsTask.Result.Resources)
        {
            bundle.Entry.Add(Entry(baseUrl, condition));
        }

        foreach (var observation in vitalsTask.Result.Resources)
        {
            bundle.Entry.Add(Entry(baseUrl, observation));
        }

        bundle.Total = bundle.Entry.Count;
        return bundle;
    }

    private TraceBuilder NewTrace() =>
        new(new DataSource(_options.SourceName, _options.BaseUrl.ToString().TrimEnd('/')), _options.PageCap);

    private static SearchParams PatientQuery(string patientId) => new SearchParams().Add("patient", patientId);

    private SearchParams ConditionQuery(string patientId) => PatientQuery(patientId).LimitTo(_options.ConditionPageSize);

    private SearchParams VitalsQuery(string patientId) =>
        PatientQuery(patientId)
            .Add("category", VITAL_SIGNS_CATEGORY)
            .OrderBy("date", SortOrder.Descending)
            .LimitTo(_options.VitalsPageSize);

    private static Bundle.EntryComponent Entry(string baseUrl, Resource resource) =>
        new() { FullUrl = $"{baseUrl}/{resource.TypeName}/{resource.Id}", Resource = resource };
}
