using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Models;
using Portfolio.Blazor.Requests;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Fakes;

/// <summary>Scriptable <see cref="IFhirClient"/>. Each method runs the delegate a test assigns and records its arguments.</summary>
internal sealed class FakeFhirClient : IFhirClient
{
    /// <summary>Requests passed to <see cref="SearchPatientsAsync"/>, in call order.</summary>
    public List<PatientSearchRequest> Searches { get; } = [];

    /// <summary>Patient ids passed to <see cref="GetSummaryAsync"/>, in call order.</summary>
    public List<string> SummaryCalls { get; } = [];

    /// <summary>Patient ids passed to <see cref="GetRawBundleAsync"/>, in call order.</summary>
    public List<string> RawCalls { get; } = [];

    /// <summary>How many times <see cref="GetCapabilityAsync"/> ran.</summary>
    public int CapabilityCalls { get; private set; }

    /// <summary>Behaviour of <see cref="SearchPatientsAsync"/>.</summary>
    public Func<PatientSearchRequest, Task<FhirResponse<PatientSearchResult>>> OnSearchPatients { get; set; } =
        _ => Task.FromResult(TestData.CreateFhirResponse(TestData.CreatePatientSearchResult()));

    /// <summary>Behaviour of <see cref="GetSummaryAsync"/>.</summary>
    public Func<string, Task<FhirResponse<PatientSummary>>> OnGetSummary { get; set; } =
        _ => Task.FromResult(TestData.CreateFhirResponse(TestData.CreatePatientSummary()));

    /// <summary>Behaviour of <see cref="GetRawBundleAsync"/>.</summary>
    public Func<string, Task<FhirResponse<string>>> OnGetRawBundle { get; set; } =
        _ => Task.FromResult(TestData.CreateFhirResponse("{\n  \"resourceType\": \"Bundle\"\n}", contentType: "application/fhir+json; charset=utf-8"));

    /// <summary>Behaviour of <see cref="GetCapabilityAsync"/>.</summary>
    public Func<Task<FhirResponse<CapabilitySubset>>> OnGetCapability { get; set; } =
        () => Task.FromResult(TestData.CreateFhirResponse(TestData.CreateCapabilitySubset()));

    /// <inheritdoc />
    public Task<FhirResponse<PatientSearchResult>> SearchPatientsAsync(PatientSearchRequest request, CancellationToken cancellationToken)
    {
        Searches.Add(request);
        return OnSearchPatients(request);
    }

    /// <inheritdoc />
    public Task<FhirResponse<PatientSummary>> GetSummaryAsync(string patientId, CancellationToken cancellationToken)
    {
        SummaryCalls.Add(patientId);
        return OnGetSummary(patientId);
    }

    /// <inheritdoc />
    public Task<FhirResponse<string>> GetRawBundleAsync(string patientId, CancellationToken cancellationToken)
    {
        RawCalls.Add(patientId);
        return OnGetRawBundle(patientId);
    }

    /// <inheritdoc />
    public Task<FhirResponse<CapabilitySubset>> GetCapabilityAsync(CancellationToken cancellationToken)
    {
        CapabilityCalls++;
        return OnGetCapability();
    }
}
