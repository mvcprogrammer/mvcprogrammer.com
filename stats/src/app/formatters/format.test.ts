import { countryName, flagOf, formatDayLong, formatDayShort, formatDelta, formatDuration, formatHour, formatNumber, formatPercent, formatPoints, formatRange, formatRelative } from './format';

describe('formatters', () => {
  it('should format numbers with separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(0)).toBe('0');
  });

  it('should format percentages with one decimal only under ten', () => {
    expect(formatPercent(0.075)).toBe('7.5%');
    expect(formatPercent(0.4249)).toBe('42%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(null)).toBe('–');
  });

  it('should format durations as seconds or minutes and seconds', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(65)).toBe('1m 05s');
    expect(formatDuration(600)).toBe('10m 00s');
    expect(formatDuration(null)).toBe('–');
  });

  it('should format deltas with a sign and points differences', () => {
    expect(formatDelta(0.18)).toBe('+18%');
    expect(formatDelta(-0.06)).toBe('-6%');
    expect(formatDelta(0)).toBe('0%');
    expect(formatDelta(null)).toBeNull();
    expect(formatPoints(0.71, 0.67)).toBe('+4 pts');
    expect(formatPoints(0.5, null)).toBeNull();
  });

  it('should format day keys without a time zone shift', () => {
    expect(formatDayShort('2026-10-17')).toBe('Oct 17');
    expect(formatDayLong('2026-10-17')).toBe('Saturday, October 17, 2026');
    expect(formatRange('2026-10-01', '2026-10-17')).toBe('Oct 1 – Oct 17, 2026');
    expect(formatRange('2026-10-17', '2026-10-17')).toBe('Oct 17, 2026');
    expect(formatRange('2025-12-20', '2026-01-05')).toBe('Dec 20, 2025 – Jan 5, 2026');
  });

  it('should format relative times in minutes, hours, and days', () => {
    const now = new Date('2026-10-18T15:00:00Z');
    expect(formatRelative('2026-10-18T14:59:40Z', now)).toBe('just now');
    expect(formatRelative('2026-10-18T14:25:00Z', now)).toBe('35 min ago');
    expect(formatRelative('2026-10-18T13:00:00Z', now)).toBe('2 h ago');
    expect(formatRelative('2026-10-15T15:00:00Z', now)).toBe('3 days ago');
    expect(formatRelative('garbage', now)).toBe('unknown');
  });

  it('should format hours, flags, and country names', () => {
    expect(formatHour(9)).toBe('09:00');
    expect(flagOf('US')).toBe('🇺🇸');
    expect(flagOf('??')).toBe('');
    expect(countryName('DE')).toBe('Germany');
    expect(countryName('??')).toBe('Unknown');
  });
});
