import { HttpStatusError, SchemaVersionError, createFetchStatsClient, type FetchLike } from './stats-client';
import { SCHEMA_VERSION } from './types';

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('createFetchStatsClient', () => {
  it('should fetch the index from under the base URL', async () => {
    // Arrange
    const calls: string[] = [];
    const fetchFn: FetchLike = async (input) => {
      calls.push(input);
      return jsonResponse(200, { schemaVersion: SCHEMA_VERSION, generatedAt: '2026-10-18T15:00:00Z', timeZone: 'America/New_York', days: ['2026-10-17'] });
    };
    const client = createFetchStatsClient('/data', fetchFn);

    // Act
    const index = await client.loadIndex();

    // Assert
    expect(calls).toEqual(['/data/index.json']);
    expect(index.days).toEqual(['2026-10-17']);
  });

  it('should load day files in parallel, cache them, and report a missing day as null', async () => {
    // Arrange
    const calls: string[] = [];
    const fetchFn: FetchLike = async (input) => {
      calls.push(input);
      if (input.endsWith('2026-10-16.json')) {
        return jsonResponse(404);
      }
      return jsonResponse(200, { schemaVersion: SCHEMA_VERSION, day: input.slice(-15, -5), timeZone: 'America/New_York', requests: 1, scannerRequests: 0, visits: [] });
    };
    const client = createFetchStatsClient('/data/', fetchFn);

    // Act
    const first = await client.loadDays(['2026-10-16', '2026-10-17']);
    const second = await client.loadDays(['2026-10-17', '2026-10-18']);

    // Assert
    expect(first.map((load) => load.day)).toEqual(['2026-10-16', '2026-10-17']);
    expect(first[0]?.file).toBeNull();
    expect(first[1]?.file?.day).toBe('2026-10-17');
    expect(second[1]?.file?.day).toBe('2026-10-18');
    expect(calls).toEqual(['/data/days/2026-10-16.json', '/data/days/2026-10-17.json', '/data/days/2026-10-18.json']); // the 17th was cached
  });

  it('should throw HttpStatusError for a server error and retry it on the next call', async () => {
    // Arrange
    let attempts = 0;
    const fetchFn: FetchLike = async () => {
      attempts++;
      return attempts === 1 ? jsonResponse(500) : jsonResponse(200, { schemaVersion: SCHEMA_VERSION, day: '2026-10-17', timeZone: 'America/New_York', requests: 0, scannerRequests: 0, visits: [] });
    };
    const client = createFetchStatsClient('/data', fetchFn);

    // Act, Assert
    await expect(client.loadDays(['2026-10-17'])).rejects.toBeInstanceOf(HttpStatusError);
    const loads = await client.loadDays(['2026-10-17']);
    expect(loads[0]?.file?.day).toBe('2026-10-17');
    expect(attempts).toBe(2);
  });

  it('should refuse a file from a newer schema', async () => {
    // Arrange
    const fetchFn: FetchLike = async () => jsonResponse(200, { schemaVersion: SCHEMA_VERSION + 1, days: [] });
    const client = createFetchStatsClient('/data', fetchFn);

    // Act, Assert
    await expect(client.loadIndex()).rejects.toBeInstanceOf(SchemaVersionError);
  });

  it('should treat a missing index as an error', async () => {
    // Arrange
    const fetchFn: FetchLike = async () => jsonResponse(404);
    const client = createFetchStatsClient('/data', fetchFn);

    // Act, Assert
    await expect(client.loadIndex()).rejects.toMatchObject({ status: 404 });
  });
});
