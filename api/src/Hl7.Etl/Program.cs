// mvcprogrammer.com — api/src/Hl7.Etl
// The HL7 v2 to FHIR ETL: messages land in Postgres, get parsed into FHIR R4, and are bulk-loaded
// into the same public HAPI sandbox the patient explorer reads.
//
//   dotnet run --project api/src/Hl7.Etl -- migrate                       # create or update the hl7 schema
//   dotnet run --project api/src/Hl7.Etl -- generate --patients 25 [--seed 1]   # land a synthetic cohort
//   dotnet run --project api/src/Hl7.Etl -- load [--batch-size 25] [--max-batches 100]   # map and bulk-load the sandbox
//   dotnet run --project api/src/Hl7.Etl -- requeue                       # replay the feed: prove the load is idempotent
//   dotnet run --project api/src/Hl7.Etl -- status                        # pending, claimed, processed, failed
//
// The connection string comes from HL7_ETL_CONNECTION (default Host=localhost;Database=hl7_etl).
using System.Globalization;
using Hl7.Etl.Extensions;
using Hl7.Etl.Interfaces;
using Hl7.Etl.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = Host.CreateApplicationBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(console => console.SingleLine = true);
builder.Services.AddEtlServices(builder.Configuration);
using var host = builder.Build();

var command = args.Length > 0 ? args[0] : "help";
using var cancellation = new CancellationTokenSource();
// The local functions below capture the token and the provider, not the disposables that own them.
var cancellationToken = cancellation.Token;
var services = host.Services;
// Top-level statements end with the process, so the handler cannot run after the source is disposed.
// ReSharper disable once AccessToDisposedClosure
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cancellation.Cancel();
};

try
{
    return command switch
    {
        "migrate" => await MigrateAsync(),
        "generate" => await GenerateAsync(),
        "load" => await LoadAsync(),
        "requeue" => await RequeueAsync(),
        "status" => await StatusAsync(),
        _ => Help(),
    };
}
catch (OperationCanceledException)
{
    Console.Error.WriteLine("Cancelled.");
    return 130;
}

async Task<int> MigrateAsync()
{
    var applied = await services.GetRequiredService<MigrationService>().ApplyAsync(MigrationService.DefaultSqlDirectory, cancellationToken);
    Console.WriteLine(applied.Count == 0 ? "Schema is up to date." : $"Applied {applied.Count}: {string.Join(", ", applied)}");
    return 0;
}

async Task<int> GenerateAsync()
{
    var patients = IntArg("--patients") ?? 25;
    var seed = IntArg("--seed") ?? 1;
    var (landed, duplicates) = await services.GetRequiredService<GenerateService>().RunAsync(patients, seed, cancellationToken);
    Console.WriteLine($"{landed} messages landed, {duplicates} had already landed (seed {seed}, {patients} patients).");
    return 0;
}

async Task<int> LoadAsync()
{
    var options = services.GetRequiredService<Microsoft.Extensions.Options.IOptions<Hl7.Etl.Configurations.EtlOptions>>().Value;
    var batchSize = IntArg("--batch-size") ?? options.BatchSize;
    var maxBatches = IntArg("--max-batches") ?? 100;
    var summary = await services.GetRequiredService<LoadService>().RunAsync(batchSize, maxBatches, cancellationToken);
    Console.WriteLine($"{summary.Batches} batches, {summary.Messages} messages: {summary.Mapped} mapped, {summary.MappingFailures} could not be mapped; {summary.Created} resources created, {summary.AlreadyPresent} already present; {summary.FailedBatches} batches failed; {summary.Elapsed.TotalSeconds:0.0} s.");
    return summary.FailedBatches == 0 && summary.MappingFailures == 0 ? 0 : 1;
}

async Task<int> RequeueAsync()
{
    var requeued = await services.GetRequiredService<IMessageRepository>().RequeueAsync(cancellationToken);
    Console.WriteLine($"{requeued} messages requeued.");
    return 0;
}

async Task<int> StatusAsync()
{
    var status = await services.GetRequiredService<IMessageRepository>().StatusAsync(cancellationToken);
    Console.WriteLine($"pending {status.Pending}, claimed {status.Claimed}, processed {status.Processed}, failed {status.Failed}");
    return 0;
}

int Help()
{
    Console.WriteLine("Commands: migrate | generate [--patients N] [--seed S] | load [--batch-size N] [--max-batches M] | requeue | status");
    return command == "help" ? 0 : 2;
}

int? IntArg(string name)
{
    var at = Array.IndexOf(args, name);
    if (at < 0 || at + 1 >= args.Length)
    {
        return null;
    }

    return int.TryParse(args[at + 1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : throw new ArgumentException($"{name} needs an integer.");
}
