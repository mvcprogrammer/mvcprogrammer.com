using System.Net;
using Hl7.Etl.Configurations;
using Hl7.Fhir.Model;
using Hl7.Etl.Generators;
using Hl7.Etl.Models;
using Hl7.Etl.Services;
using Hl7.Etl.Tests.Fakes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Polly;
using Task = System.Threading.Tasks.Task;

namespace Hl7.Etl.Tests.Services;

/// <summary>The loader over an in-memory landing table and a scripted FHIR server behind the real resilient HttpClient.</summary>
public sealed class LoadServiceTests
{
    private static readonly CancellationToken _ct = TestContext.Current.CancellationToken;
    private static readonly SyntheticPatient _patient = new SyntheticCohortGenerator(3).Patients(1)[0];

    [Fact]
    public async Task A_clean_batch_is_posted_once_and_completed_with_the_bundle_id()
    {
        var repository = new InMemoryMessageRepository().WithBatch(Admission(1), Vitals(2));
        var handler = new ScriptedHandler().ThenTransactionResponse("resp-1", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created");
        var loader = Loader(repository, handler);

        var summary = await loader.RunAsync(25, 10, _ct);

        Assert.Equal(new LoadSummary(1, 2, 2, 0, 8, 0, 0, summary.Elapsed), summary);
        var (ids, bundleId) = Assert.Single(repository.Completed);
        Assert.Equal([1L, 2L], ids);
        Assert.Equal("resp-1", bundleId);
        Assert.Empty(repository.Failed);
        var sent = Assert.Single(handler.Received);
        Assert.Equal(8, sent.Entry.Count);
        Assert.Equal("return=minimal", Assert.Single(handler.Prefer));
        Assert.Equal([25, 25], repository.Claims);
    }

    [Fact]
    public async Task Resources_the_server_already_had_are_counted_as_present()
    {
        var repository = new InMemoryMessageRepository().WithBatch(Admission(1));
        var handler = new ScriptedHandler().ThenTransactionResponse("resp-2", "200 OK", "201 Created");

        var summary = await Loader(repository, handler).RunAsync(25, 10, _ct);

        Assert.Equal(1, summary.Created);
        Assert.Equal(1, summary.AlreadyPresent);
        Assert.Single(repository.Completed);
    }

    [Fact]
    public async Task A_message_that_cannot_be_mapped_is_failed_alone_and_the_rest_of_the_batch_goes_on()
    {
        var broken = Admission(1) with { MessageType = "ORM", TriggerEvent = "O01", MessageControlId = "MVC003-000099" };
        var repository = new InMemoryMessageRepository().WithBatch(broken, Admission(2));
        var handler = new ScriptedHandler().ThenTransactionResponse("resp-3", "201 Created", "201 Created");

        var summary = await Loader(repository, handler).RunAsync(25, 10, _ct);

        Assert.Equal(2, summary.Messages);
        Assert.Equal(1, summary.Mapped);
        Assert.Equal(1, summary.MappingFailures);
        var (failedIds, error) = Assert.Single(repository.Failed);
        Assert.Equal([1L], failedIds);
        Assert.Equal("MVC003-000099: MSH.9: ORM^O01 is not a message this ETL maps (ADT^A01, ORU^R01).", error);
        Assert.Equal([2L], Assert.Single(repository.Completed).Ids);
        Assert.Equal(2, Assert.Single(handler.Received).Entry.Count);
    }

    [Fact]
    public async Task A_batch_the_server_rejects_is_failed_with_the_outcome_text_and_nothing_is_completed()
    {
        var repository = new InMemoryMessageRepository().WithBatch(Admission(1), Vitals(2));
        var handler = new ScriptedHandler().ThenOutcome(HttpStatusCode.BadRequest, "HAPI-0123: Invalid reference");

        var summary = await Loader(repository, handler).RunAsync(25, 10, _ct);

        Assert.Equal(1, summary.FailedBatches);
        Assert.Equal(0, summary.Created);
        Assert.Empty(repository.Completed);
        var (ids, error) = Assert.Single(repository.Failed);
        Assert.Equal([1L, 2L], ids);
        Assert.Equal("The server answered 400 BadRequest: HAPI-0123: Invalid reference", error);
    }

    [Fact]
    public async Task A_server_that_never_answers_fails_the_batch_within_the_budget()
    {
        var repository = new InMemoryMessageRepository().WithBatch(Admission(1));
        var handler = new ScriptedHandler().ThenHang().ThenHang();

        var summary = await Loader(repository, handler, attemptTimeoutMs: 1_000, totalTimeoutMs: 3_000, retries: 1).RunAsync(25, 10, _ct);

        Assert.Equal(1, summary.FailedBatches);
        var (_, error) = Assert.Single(repository.Failed);
        Assert.Equal("The server did not answer within the budget.", error);
        Assert.Equal(2, handler.Prefer.Count); // the first attempt and one retry
    }

    [Fact]
    public async Task A_reference_to_a_patient_loaded_by_an_earlier_batch_is_resolved_by_one_lookup()
    {
        var repository = new InMemoryMessageRepository().WithBatch(Vitals(2), Vitals(3));
        var handler = new ScriptedHandler().ThenTransactionResponse("resp-4", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created", "201 Created");
        handler.Found[Lookup("Patient", _patient.Mrn)] = "4242";
        handler.Found[Lookup("Encounter", _patient.VisitNumber)] = "4343";

        var summary = await Loader(repository, handler).RunAsync(25, 10, _ct);

        Assert.Equal(1, summary.Batches);
        Assert.Equal(2, summary.Mapped);
        Assert.Equal(0, summary.MappingFailures);
        Assert.Equal([Lookup("Patient", _patient.Mrn), Lookup("Encounter", _patient.VisitNumber)], handler.Lookups); // once each, not once per observation
        var sent = Assert.Single(handler.Received);
        Assert.All(sent.Entry, entry =>
        {
            var observation = (Observation)entry.Resource!;
            Assert.Equal("Patient/4242", observation.Subject!.Reference);
            Assert.Equal("Encounter/4343", observation.Encounter!.Reference);
        });
    }

    [Fact]
    public async Task A_message_whose_patient_is_not_on_the_server_yet_is_set_aside_and_the_batch_goes_on()
    {
        var repository = new InMemoryMessageRepository().WithBatch(Vitals(2), Admission(3, _other)); // another patient's admission, so the vitals' patient is not in the batch
        var handler = new ScriptedHandler().ThenTransactionResponse("resp-5", "201 Created", "201 Created");

        var summary = await Loader(repository, handler).RunAsync(25, 10, _ct);

        Assert.Equal(1, summary.Mapped);
        Assert.Equal(1, summary.MappingFailures);
        var (ids, error) = Assert.Single(repository.Failed);
        Assert.Equal([2L], ids);
        Assert.Equal($"MVC003-000002: references Patient {_system}|{_patient.Mrn}, which the server does not have yet.", error);
        Assert.Equal([3L], Assert.Single(repository.Completed).Ids);
        Assert.Equal([Lookup("Patient", _patient.Mrn)], handler.Lookups); // stops at the first missing target
    }

    [Theory]
    [InlineData("https://hapi.fhir.org/baseR4", "https://hapi.fhir.org/baseR4/")]
    [InlineData("https://hapi.fhir.org/baseR4/", "https://hapi.fhir.org/baseR4/")]
    public void The_base_address_keeps_its_last_segment(string configured, string expected)
    {
        Assert.Equal(new Uri(expected), HttpBundleClient.BaseAddressOf(new Uri(configured)));
    }

    [Fact]
    public async Task Nothing_pending_means_no_post()
    {
        var repository = new InMemoryMessageRepository();
        var handler = new ScriptedHandler();

        var summary = await Loader(repository, handler).RunAsync(25, 10, _ct);

        Assert.Equal(0, summary.Batches);
        Assert.Empty(handler.Received);
    }

    [Fact]
    public async Task The_batch_cap_stops_a_run()
    {
        var repository = new InMemoryMessageRepository().WithBatch(Admission(1)).WithBatch(Admission(2)).WithBatch(Admission(3));
        var handler = new ScriptedHandler().ThenTransactionResponse("a", "201 Created", "201 Created").ThenTransactionResponse("b", "201 Created", "201 Created");

        var summary = await Loader(repository, handler).RunAsync(1, 2, _ct);

        Assert.Equal(2, summary.Batches);
        Assert.Equal(2, repository.Completed.Count);
    }

    private static LoadService Loader(InMemoryMessageRepository repository, ScriptedHandler handler, int attemptTimeoutMs = 5_000, int totalTimeoutMs = 10_000, int retries = 1)
    {
        var options = new EtlOptions { AttemptTimeoutMs = attemptTimeoutMs, TotalTimeoutMs = totalTimeoutMs, RetryCount = retries };
        var services = new ServiceCollection();
        services.AddHttpClient(HttpBundleClient.CLIENT_NAME, client => client.BaseAddress = HttpBundleClient.BaseAddressOf(options.FhirBaseUrl))
            .ConfigurePrimaryHttpMessageHandler(() => handler)
            .AddStandardResilienceHandler()
            .Configure(resilience =>
            {
                resilience.AttemptTimeout.Timeout = TimeSpan.FromMilliseconds(options.AttemptTimeoutMs);
                resilience.TotalRequestTimeout.Timeout = TimeSpan.FromMilliseconds(options.TotalTimeoutMs);
                resilience.Retry.MaxRetryAttempts = options.RetryCount;
                resilience.Retry.Delay = TimeSpan.FromMilliseconds(10);
                resilience.Retry.BackoffType = DelayBackoffType.Constant;
                resilience.CircuitBreaker.SamplingDuration = TimeSpan.FromMilliseconds(options.AttemptTimeoutMs * 2);
            });
        var factory = services.BuildServiceProvider().GetRequiredService<IHttpClientFactory>();
        return new LoadService(repository, new HttpBundleClient(factory), Options.Create(options), NullLogger<LoadService>.Instance);
    }

    private static readonly Uri _system = new EtlOptions().IdentifierSystem;

    private static string Lookup(string type, string value) => $"/baseR4/{type}?identifier={Uri.EscapeDataString($"{_system}|{value}")}&_count=1";

    private static readonly SyntheticPatient _other = new SyntheticCohortGenerator(3).Patients(2)[1];

    private static LandedMessage Admission(long id, SyntheticPatient? patient = null) => Landed(Hl7MessageComposer.Admission(patient ?? _patient, $"MVC003-{id:D6}"), id);

    private static LandedMessage Vitals(long id) => Landed(Hl7MessageComposer.VitalSigns(_patient, $"MVC003-{id:D6}", new DateTimeOffset(2026, 10, 31, 9, 30, 0, TimeSpan.Zero), new VitalSignValues(72, 120, 80, 36.8, 16, 98)), id);

    private static LandedMessage Landed(InboundMessage inbound, long id) =>
        new(id, inbound.MessageControlId, inbound.MessageType, inbound.TriggerEvent, inbound.SendingFacility, inbound.ReceivedAt, inbound.RawMessage, 1);
}
