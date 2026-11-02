using System.Diagnostics.CodeAnalysis;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace Hl7.Etl.Services;

/// <summary>
/// Applies the SQL files under <c>Sql/</c> in name order, once each, recording them in
/// <c>hl7.schema_migrations</c>. The bootstrap of the schema and that table is the one piece of
/// SQL the application carries, because nothing can exist before it runs.
/// </summary>
public sealed class MigrationService
{
    private const string BOOTSTRAP = "CREATE SCHEMA IF NOT EXISTS hl7; CREATE TABLE IF NOT EXISTS hl7.schema_migrations (file_name text NOT NULL PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());";
    private const string APPLIED = "SELECT file_name FROM hl7.schema_migrations";
    private const string RECORD = "INSERT INTO hl7.schema_migrations (file_name) VALUES ($1)";

    private readonly NpgsqlDataSource _dataSource;
    private readonly ILogger<MigrationService> _logger;

    /// <summary>Creates the service over the application's data source.</summary>
    public MigrationService(NpgsqlDataSource dataSource, ILogger<MigrationService> logger)
    {
        ArgumentNullException.ThrowIfNull(dataSource);
        ArgumentNullException.ThrowIfNull(logger);
        _dataSource = dataSource;
        _logger = logger;
    }

    /// <summary>The folder the SQL files ship in, beside the binary.</summary>
    public static string DefaultSqlDirectory => Path.Combine(AppContext.BaseDirectory, "Sql");

    /// <summary>Applies every file in <paramref name="sqlDirectory"/> that is not yet recorded. Returns the names applied, in order.</summary>
    [SuppressMessage("Security", "CA2100:Review SQL queries for security vulnerabilities", Justification = "The text is the application's own migration file, read from beside the binary, never from input.")]
    public async Task<IReadOnlyList<string>> ApplyAsync(string sqlDirectory, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sqlDirectory);
        if (!Directory.Exists(sqlDirectory))
        {
            throw new DirectoryNotFoundException($"No SQL directory at {sqlDirectory}.");
        }

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using (var bootstrap = new NpgsqlCommand(BOOTSTRAP, connection))
        {
            await bootstrap.ExecuteNonQueryAsync(cancellationToken);
        }

        var applied = new HashSet<string>(StringComparer.Ordinal);
        await using (var query = new NpgsqlCommand(APPLIED, connection))
        await using (var reader = await query.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                applied.Add(reader.GetString(0));
            }
        }

        var appliedNow = new List<string>();
        foreach (var path in Directory.GetFiles(sqlDirectory, "*.sql").OrderBy(file => file, StringComparer.Ordinal))
        {
            var name = Path.GetFileName(path);
            if (applied.Contains(name))
            {
                continue;
            }

            var sql = await File.ReadAllTextAsync(path, cancellationToken);
            await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
            await using (var apply = new NpgsqlCommand(sql, connection, transaction))
            {
                await apply.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var record = new NpgsqlCommand(RECORD, connection, transaction))
            {
                record.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = name });
                await record.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            appliedNow.Add(name);
            _logger.LogInformation("Applied {Migration}", name);
        }

        return appliedNow;
    }
}
