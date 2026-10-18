import { makeDay, makeVisit } from '../../testing/fixtures';
import { buildSeries, sparkline, type DayVisits } from './series';

function dayVisits(day: string, count: number, missing = false): DayVisits {
  const visits = Array.from({ length: count }, (_, i) => makeVisit({ token: `t${i}`, loads: i % 2, seconds: i % 2 === 0 ? undefined : 30 }));
  return { day, file: missing ? null : makeDay(day, visits), visits };
}

describe('series', () => {
  it('should produce one point per day, with missing days flagged and zeroed', () => {
    // Arrange
    const range = { from: '2026-10-15', to: '2026-10-18' };
    const days = [dayVisits('2026-10-15', 4), dayVisits('2026-10-17', 2)];

    // Act
    const points = buildSeries(range, days);

    // Assert
    expect(points.map((p) => p.key)).toEqual(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect(points.map((p) => p.visits)).toEqual([4, 0, 2, 0]);
    expect(points.map((p) => p.missing)).toEqual([false, true, false, true]);
    expect(points[0]?.beaconReach).toBe(0.5);
    expect(points[0]?.medianSeconds).toBe(30);
    expect(points[1]?.beaconReach).toBeNull();
    expect(points[0]?.requests).toBe(90);
  });

  it('should bucket by week from 91 days, keyed by Monday', () => {
    // Arrange
    const range = { from: '2026-07-20', to: '2026-10-18' }; // 91 days, starting on a Monday
    const days = [dayVisits('2026-07-20', 3), dayVisits('2026-07-26', 2), dayVisits('2026-10-18', 1)];

    // Act
    const points = buildSeries(range, days);

    // Assert
    expect(points).toHaveLength(13);
    expect(points[0]).toMatchObject({ key: '2026-07-20', visits: 5, missing: true });
    expect(points[12]).toMatchObject({ key: '2026-10-12', visits: 1 });
  });

  it('should give the last seven values for a sparkline with nulls as zero', () => {
    // Arrange
    const points = buildSeries({ from: '2026-10-09', to: '2026-10-18' }, [dayVisits('2026-10-18', 3)]);

    // Act, Assert
    expect(sparkline(points, (p) => p.visits)).toEqual([0, 0, 0, 0, 0, 0, 3]);
    expect(sparkline(points, (p) => p.beaconReach)).toHaveLength(7);
  });
});
