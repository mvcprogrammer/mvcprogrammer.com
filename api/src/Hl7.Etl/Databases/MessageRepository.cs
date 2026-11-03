using Hl7.Etl.Interfaces;
using Hl7.Etl.Mappers;
using Hl7.Etl.Models;
using Npgsql;
using NpgsqlTypes;

namespace Hl7.Etl.Databases;

/// <summary>
/// The landing table through its Postgres functions, one connection per operation from the pooled
/// data source. Each method is one function call with typed parameters: the Postgres equivalent
/// of the coding standard's stored-procedure path (a Postgres procedure cannot return rows, so
/// these are functions selected from).
/// </summary>
public sealed class MessageRepository : IMessageRepository
{
    private const int COMMAND_TIMEOUT_SECONDS = 30;
    private const string INSERT_CALL = "SELECT hl7.messages_insert($1, $2, $3, $4, $5, $6)";
    private const string CLAIM_CALL = "SELECT * FROM hl7.messages_claim($1, $2)";
    private const string COMPLETE_CALL = "SELECT hl7.messages_complete($1, $2)";
    private const string FAIL_CALL = "SELECT hl7.messages_fail($1, $2)";
    private const string STATUS_CALL = "SELECT * FROM hl7.messages_status()";
    private const string REQUEUE_CALL = "SELECT hl7.messages_requeue()";

    private readonly NpgsqlDataSource _dataSource;

    /// <summary>Creates the repository over the application's one data source.</summary>
    public MessageRepository(NpgsqlDataSource dataSource)
    {
        ArgumentNullException.ThrowIfNull(dataSource);
        _dataSource = dataSource;
    }

    /// <inheritdoc />
    public async Task<long?> InsertAsync(InboundMessage message, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(INSERT_CALL, connection);
        command.CommandTimeout = COMMAND_TIMEOUT_SECONDS;
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = message.MessageControlId });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = message.MessageType });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = message.TriggerEvent });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = message.SendingFacility });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.TimestampTz, Value = message.ReceivedAt.UtcDateTime });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = message.RawMessage });
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is long id ? id : null;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<LandedMessage>> ClaimAsync(int batchSize, TimeSpan staleAfter, CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(batchSize, 1);

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(CLAIM_CALL, connection);
        command.CommandTimeout = COMMAND_TIMEOUT_SECONDS;
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Integer, Value = batchSize });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Interval, Value = staleAfter });
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await LandedMessageMapper.ReadAllAsync(reader, cancellationToken);
    }

    /// <inheritdoc />
    public Task<int> CompleteAsync(IReadOnlyList<long> messageIds, string fhirBundleId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(messageIds);
        ArgumentException.ThrowIfNullOrWhiteSpace(fhirBundleId);
        return MarkAsync(messageIds, fhirBundleId, complete: true, cancellationToken);
    }

    /// <inheritdoc />
    public Task<int> FailAsync(IReadOnlyList<long> messageIds, string error, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(messageIds);
        ArgumentException.ThrowIfNullOrWhiteSpace(error);
        return MarkAsync(messageIds, error, complete: false, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<LandingStatus> StatusAsync(CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(STATUS_CALL, connection);
        command.CommandTimeout = COMMAND_TIMEOUT_SECONDS;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await LandedMessageMapper.ReadStatusAsync(reader, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<int> RequeueAsync(CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(REQUEUE_CALL, connection);
        command.CommandTimeout = COMMAND_TIMEOUT_SECONDS;
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is int requeued ? requeued : 0;
    }

    private async Task<int> MarkAsync(IReadOnlyList<long> messageIds, string text, bool complete, CancellationToken cancellationToken)
    {
        if (messageIds.Count == 0)
        {
            return 0;
        }

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        // Two constant calls, chosen here rather than passed in, so the command text is never a parameter (CA2100).
        await using var command = complete
            ? new NpgsqlCommand(COMPLETE_CALL, connection) { CommandTimeout = COMMAND_TIMEOUT_SECONDS }
            : new NpgsqlCommand(FAIL_CALL, connection) { CommandTimeout = COMMAND_TIMEOUT_SECONDS };
        // Npgsql documents Array | <element type> as the way to name an array parameter; the enum has no [Flags].
        // ReSharper disable once BitwiseOperatorOnEnumWithoutFlags
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Array | NpgsqlDbType.Bigint, Value = messageIds.ToArray() });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = text });
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is int updated ? updated : 0;
    }
}
