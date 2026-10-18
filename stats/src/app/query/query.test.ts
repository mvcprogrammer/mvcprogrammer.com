import { DEFAULT_PRESET, parseQuery, resolvePreset, segmentOn, serializeQuery, withSegment, withoutSegment, type Query } from './query';

const TODAY = '2026-10-18';

describe('query', () => {
  it('should resolve every preset relative to today', () => {
    expect(resolvePreset('today', TODAY)).toEqual({ from: '2026-10-18', to: '2026-10-18' });
    expect(resolvePreset('7d', TODAY)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(resolvePreset('30d', TODAY)).toEqual({ from: '2026-09-19', to: '2026-10-18' });
    expect(resolvePreset('90d', TODAY)).toEqual({ from: '2026-07-21', to: '2026-10-18' });
    expect(resolvePreset('month', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-18' });
    expect(resolvePreset('last-month', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(resolvePreset('last-month', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('should parse an empty search as the default 30-day view', () => {
    // Act
    const query = parseQuery('', TODAY);

    // Assert
    expect(query).toEqual({ range: { from: '2026-09-19', to: '2026-10-18' }, preset: DEFAULT_PRESET, compare: false, segments: [] });
  });

  it('should parse a preset, compare, and segments', () => {
    // Act
    const query = parseQuery('?range=7d&compare=1&seg=edition:react,screen:phone,referrer:www.linkedin.com', TODAY);

    // Assert
    expect(query.preset).toBe('7d');
    expect(query.range).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(query.compare).toBe(true);
    expect(query.segments).toEqual([
      { dimension: 'edition', value: 'react' },
      { dimension: 'screen', value: 'phone' },
      { dimension: 'referrer', value: 'www.linkedin.com' },
    ]);
  });

  it('should parse a custom range and ignore a backwards or malformed one', () => {
    expect(parseQuery('?from=2026-10-01&to=2026-10-15', TODAY)).toMatchObject({ preset: null, range: { from: '2026-10-01', to: '2026-10-15' } });
    expect(parseQuery('?from=2026-10-15&to=2026-10-01', TODAY).preset).toBe(DEFAULT_PRESET);
    expect(parseQuery('?from=yesterday&to=today', TODAY).preset).toBe(DEFAULT_PRESET);
    expect(parseQuery('?range=forever', TODAY).preset).toBe(DEFAULT_PRESET);
  });

  it('should drop unknown dimensions, empty values, and a second segment on the same dimension', () => {
    // Act
    const query = parseQuery('?seg=planet:mars,edition:,edition:js,edition:react,nocolon', TODAY);

    // Assert
    expect(query.segments).toEqual([{ dimension: 'edition', value: 'js' }]);
  });

  it('should serialize to the shortest search string that reproduces the query', () => {
    // Arrange
    const base: Query = { range: resolvePreset('30d', TODAY), preset: '30d', compare: false, segments: [] };

    // Act, Assert
    expect(serializeQuery(base)).toBe('');
    expect(serializeQuery({ ...base, preset: '7d', range: resolvePreset('7d', TODAY) })).toBe('?range=7d');
    expect(serializeQuery({ ...base, preset: null, range: { from: '2026-10-01', to: '2026-10-15' } })).toBe('?from=2026-10-01&to=2026-10-15');
    expect(serializeQuery({ ...base, compare: true, segments: [{ dimension: 'country', value: 'US' }, { dimension: 'referrer', value: '(direct)' }] })).toBe(
      '?compare=1&seg=country%3AUS%2Creferrer%3A%28direct%29',
    );
  });

  it('should round-trip through serialize and parse', () => {
    // Arrange
    const query: Query = {
      range: { from: '2026-10-01', to: '2026-10-15' },
      preset: null,
      compare: true,
      segments: [
        { dimension: 'edition', value: 'angular' },
        { dimension: 'referrer', value: 'news.ycombinator.com' },
      ],
    };

    // Act, Assert
    expect(parseQuery(serializeQuery(query), TODAY)).toEqual(query);
  });

  it('should add, replace, and remove segments by dimension', () => {
    // Arrange
    const base: Query = { range: resolvePreset('30d', TODAY), preset: '30d', compare: false, segments: [{ dimension: 'edition', value: 'js' }] };

    // Act
    const added = withSegment(base, { dimension: 'screen', value: 'phone' });
    const replaced = withSegment(added, { dimension: 'edition', value: 'react' });
    const removed = withoutSegment(replaced, 'screen');

    // Assert
    expect(added.segments.map((segment) => segment.value)).toEqual(['js', 'phone']);
    expect(replaced.segments.map((segment) => segment.value)).toEqual(['phone', 'react']);
    expect(removed.segments).toEqual([{ dimension: 'edition', value: 'react' }]);
    expect(segmentOn(removed, 'edition')?.value).toBe('react');
    expect(segmentOn(removed, 'screen')).toBeUndefined();
  });
});
