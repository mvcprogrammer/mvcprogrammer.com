using Hl7.Etl.Databases;
using Hl7.Etl.Models;
using Hl7.Etl.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace Hl7.Etl.Tests.Databases;

/// <summary>
/// Runs against a real Postgres named by HL7_ETL_TEST_CONNECTION (a database the test may empty);
/// skipped when the variable is absent, as on a laptop without one. CI provides a service container.
/// </summary>
public sealed class MessageRepositoryTests : IAsyncLifetime
{
    private static readonly string? _connection = Environment.GetEnvironmentVariable("HL7_ETL_TEST_CONNECTION");
    private static readonly CancellationToken _ct = TestContext.Current.CancellationToken;

    private NpgsqlDataSource? _dataSource;

    public async ValueTask InitializeAsync()
    {
        if (_connection is null)
        {
            return;
        }

        _dataSource = NpgsqlDataSource.Create(_connection);
        await using (var connection = await _dataSource.OpenConnectionAsync(_ct))
        await using (var reset = new NpgsqlCommand("DROP SCHEMA IF EXISTS hl7 CASCADE", connection))
        {
            await reset.ExecuteNonQueryAsync(_ct);
        }

        var migrations = new MigrationService(_dataSource, NullLogger<MigrationService>.Instance);
        await migrations.ApplyAsync(MigrationService.DefaultSqlDirectory, _ct);
    }

    public async ValueTask DisposeAsync()
    {
        if (_dataSource is not null)
        {
            await _dataSource.DisposeAsync();
        }
    }

    [Fact]
    public async Task Migrate_is_idempotent()
    {
        if (_dataSource is null)
        {
            Assert.Skip("HL7_ETL_TEST_CONNECTION is not set.");
        }

        var migrations = new MigrationService(_dataSource, NullLogger<MigrationService>.Instance);
        var again = await migrations.ApplyAsync(MigrationService.DefaultSqlDirectory, _ct);

        Assert.Empty(again);
    }

    [Fact]
    public async Task Insert_lands_once_per_control_id_and_status_counts_it_as_pending()
    {
        if (_dataSource is null)
        {
            Assert.Skip("HL7_ETL_TEST_CONNECTION is not set.");
        }

        var repository = new MessageRepository(_dataSource);
        var message = Inbound("MSG-1");

        var first = await repository.InsertAsync(message, _ct);
        var second = await repository.InsertAsync(message, _ct);
        var status = await repository.StatusAsync(_ct);

        Assert.NotNull(first);
        Assert.Null(second);
        Assert.Equal(new LandingStatus(1, 0, 0, 0), status);
    }

    [Fact]
    public async Task Claim_takes_pending_rows_in_arrival_order_and_complete_or_fail_settles_them()
    {
        if (_dataSource is null)
        {
            Assert.Skip("HL7_ETL_TEST_CONNECTION is not set.");
        }

        var repository = new MessageRepository(_dataSource);
        foreach (var id in new[] { "MSG-1", "MSG-2", "MSG-3" })
        {
            await repository.InsertAsync(Inbound(id), _ct);
        }

        var batch = await repository.ClaimAsync(2, TimeSpan.FromMinutes(10), _ct);
        Assert.Equal(["MSG-1", "MSG-2"], batch.Select(m => m.MessageControlId));
        Assert.All(batch, m => Assert.Equal(1, m.AttemptCount));
        Assert.Equal("ADT", batch[0].MessageType);
        Assert.Equal("MSH|^~\\&|APP", batch[0].RawMessage);
        Assert.Equal(new LandingStatus(1, 2, 0, 0), await repository.StatusAsync(_ct));

        var nothingElse = await repository.ClaimAsync(2, TimeSpan.FromMinutes(10), _ct);
        Assert.Equal(["MSG-3"], nothingElse.Select(m => m.MessageControlId));

        Assert.Equal(1, await repository.CompleteAsync([batch[0].MessageId], "bundle-1", _ct));
        Assert.Equal(1, await repository.FailAsync([batch[1].MessageId], "the sandbox said no", _ct));
        Assert.Equal(new LandingStatus(0, 2, 1, 1), await repository.StatusAsync(_ct)); // the failed row keeps its claim

        Assert.Empty(await repository.ClaimAsync(5, TimeSpan.FromMinutes(10), _ct)); // not retried within the stale window
        var retried = await repository.ClaimAsync(5, TimeSpan.Zero, _ct);
        Assert.Equal(["MSG-2", "MSG-3"], retried.Select(m => m.MessageControlId));
        Assert.Equal(2, retried[0].AttemptCount);
    }

    [Fact]
    public async Task A_stale_claim_is_claimed_again_and_a_fresh_one_is_not()
    {
        if (_dataSource is null)
        {
            Assert.Skip("HL7_ETL_TEST_CONNECTION is not set.");
        }

        var repository = new MessageRepository(_dataSource);
        await repository.InsertAsync(Inbound("MSG-1"), _ct);
        var held = await repository.ClaimAsync(1, TimeSpan.FromMinutes(10), _ct);
        Assert.Single(held);

        Assert.Empty(await repository.ClaimAsync(1, TimeSpan.FromMinutes(10), _ct));
        var stolen = await repository.ClaimAsync(1, TimeSpan.Zero, _ct);
        Assert.Equal(2, Assert.Single(stolen).AttemptCount);
    }

    [Fact]
    public async Task Requeue_puts_processed_messages_back_and_leaves_pending_ones_alone()
    {
        if (_dataSource is null)
        {
            Assert.Skip("HL7_ETL_TEST_CONNECTION is not set.");
        }

        var repository = new MessageRepository(_dataSource);
        await repository.InsertAsync(Inbound("MSG-1"), _ct);
        await repository.InsertAsync(Inbound("MSG-2"), _ct);
        var batch = await repository.ClaimAsync(1, TimeSpan.FromMinutes(10), _ct);
        await repository.CompleteAsync([batch[0].MessageId], "bundle-1", _ct);
        Assert.Equal(new LandingStatus(1, 0, 1, 0), await repository.StatusAsync(_ct));

        Assert.Equal(1, await repository.RequeueAsync(_ct));
        Assert.Equal(new LandingStatus(2, 0, 0, 0), await repository.StatusAsync(_ct));
        Assert.Equal(0, await repository.RequeueAsync(_ct));
    }

    [Fact]
    public async Task Complete_and_fail_with_no_ids_touch_nothing()
    {
        if (_dataSource is null)
        {
            Assert.Skip("HL7_ETL_TEST_CONNECTION is not set.");
        }

        var repository = new MessageRepository(_dataSource);

        Assert.Equal(0, await repository.CompleteAsync([], "bundle", _ct));
        Assert.Equal(0, await repository.FailAsync([], "error", _ct));
    }

    private static InboundMessage Inbound(string controlId) =>
        new(controlId, "ADT", "A01", "TEST", new DateTimeOffset(2026, 11, 1, 8, 0, 0, TimeSpan.Zero), "MSH|^~\\&|APP");
}
