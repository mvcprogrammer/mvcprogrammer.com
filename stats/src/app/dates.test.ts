import { addDays, dayKeysBetween, daysBetween, isDayKey, monthEnd, monthStart, previousPeriod, rangeLength, todayKey, weekStart } from './dates';

describe('dates', () => {
  it('should give today in the site time zone, not UTC', () => {
    // Arrange, Act, Assert
    expect(todayKey(new Date('2026-10-18T03:50:00Z'))).toBe('2026-10-17');
    expect(todayKey(new Date('2026-10-18T04:00:00Z'))).toBe('2026-10-18');
    expect(todayKey(new Date('2026-01-15T04:30:00Z'))).toBe('2026-01-14');
  });

  it('should validate day keys', () => {
    expect(isDayKey('2026-10-17')).toBe(true);
    expect(isDayKey('2026-13-01')).toBe(false);
    expect(isDayKey('2026-02-31')).toBe(false);
    expect(isDayKey('2024-02-29')).toBe(true);
    expect(isDayKey('2026-1-1')).toBe(false);
    expect(isDayKey('yesterday')).toBe(false);
  });

  it('should add and subtract days across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('should count days between keys and list them', () => {
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
    expect(daysBetween('2026-10-31', '2026-10-01')).toBe(-30);
    expect(dayKeysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(dayKeysBetween('2026-10-18', '2026-10-17')).toEqual([]);
    expect(rangeLength({ from: '2026-10-01', to: '2026-10-30' })).toBe(30);
  });

  it('should find month bounds', () => {
    expect(monthStart('2026-10-17')).toBe('2026-10-01');
    expect(monthEnd('2026-10-17')).toBe('2026-10-31');
    expect(monthEnd('2026-02-10')).toBe('2026-02-28');
    expect(monthEnd('2024-02-10')).toBe('2024-02-29');
  });

  it('should give the previous period of the same length ending the day before', () => {
    expect(previousPeriod({ from: '2026-10-11', to: '2026-10-17' })).toEqual({ from: '2026-10-04', to: '2026-10-10' });
    expect(previousPeriod({ from: '2026-10-17', to: '2026-10-17' })).toEqual({ from: '2026-10-16', to: '2026-10-16' });
  });

  it('should find the Monday of a week', () => {
    expect(weekStart('2026-10-17')).toBe('2026-10-12'); // a Saturday
    expect(weekStart('2026-10-12')).toBe('2026-10-12'); // the Monday itself
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // a Sunday belongs to the week before
  });
});
