import { addDays, isDayKey, monthEnd, monthStart, type DayKey, type DayRange } from '../dates';

/** The named ranges in the picker, relative to today. */
export const RANGE_PRESETS = ['today', '7d', '30d', '90d', 'month', 'last-month'] as const;

/** One of the named ranges. */
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** How each preset is named on screen. */
export const PRESET_LABELS: Readonly<Record<RangePreset, string>> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  month: 'This month',
  'last-month': 'Last month',
};

/** The default range when the URL names none. */
export const DEFAULT_PRESET: RangePreset = '30d';

/** The dimensions a visit can be filtered on, matching the day-file fields. */
export const DIMENSIONS = ['edition', 'screen', 'scheme', 'referrer', 'country'] as const;

/** One of the filterable dimensions. */
export type Dimension = (typeof DIMENSIONS)[number];

/** How each dimension is named on a chip. */
export const DIMENSION_LABELS: Readonly<Record<Dimension, string>> = {
  edition: 'Edition',
  screen: 'Screen',
  scheme: 'Scheme',
  referrer: 'Referrer',
  country: 'Country',
};

/** The referrer value that stands for a visit with no external referrer. */
export const DIRECT = '(direct)';

/** A filter on one dimension. */
export interface Segment {
  readonly dimension: Dimension;
  readonly value: string;
}

/** Everything the page shows is a function of this and the data. The URL holds it. */
export interface Query {
  /** The range, resolved to days; `preset` says which named range produced it, or null for a custom one. */
  readonly range: DayRange;
  readonly preset: RangePreset | null;
  /** Overlay the previous period and show deltas. */
  readonly compare: boolean;
  /** Filters, at most one per dimension, in the order they were added. */
  readonly segments: readonly Segment[];
}

/** The days a preset covers, ending today. */
export function resolvePreset(preset: RangePreset, today: DayKey): DayRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case '90d':
      return { from: addDays(today, -89), to: today };
    case 'month':
      return { from: monthStart(today), to: today };
    case 'last-month': {
      const end = addDays(monthStart(today), -1);
      return { from: monthStart(end), to: monthEnd(end) };
    }
  }
}

function isPreset(value: string): value is RangePreset {
  return (RANGE_PRESETS as readonly string[]).includes(value);
}

function isDimension(value: string): value is Dimension {
  return (DIMENSIONS as readonly string[]).includes(value);
}

/**
 * The query a URL's search string describes. Unknown or malformed values fall back to the default,
 * so a stale bookmark still opens something sensible: `range=<preset>` or `from=&to=` for the
 * range, `compare=1`, and `seg=edition:react,screen:phone` for the segments.
 */
export function parseQuery(search: string, today: DayKey): Query {
  const params = new URLSearchParams(search);
  const rangeParam = params.get('range');
  const from = params.get('from');
  const to = params.get('to');

  let preset: RangePreset | null = DEFAULT_PRESET;
  let range = resolvePreset(DEFAULT_PRESET, today);
  if (rangeParam !== null && isPreset(rangeParam)) {
    preset = rangeParam;
    range = resolvePreset(rangeParam, today);
  } else if (from !== null && to !== null && isDayKey(from) && isDayKey(to) && from <= to) {
    preset = null;
    range = { from, to };
  }

  const segments: Segment[] = [];
  for (const part of (params.get('seg') ?? '').split(',')) {
    const colon = part.indexOf(':');
    if (colon <= 0) {
      continue;
    }
    const dimension = part.slice(0, colon);
    let value: string;
    try {
      value = decodeURIComponent(part.slice(colon + 1));
    } catch {
      continue; // a stray percent sign in a hand-edited URL is not a crash
    }
    if (isDimension(dimension) && value !== '' && !segments.some((segment) => segment.dimension === dimension)) {
      segments.push({ dimension, value });
    }
  }

  return { range, preset, compare: params.get('compare') === '1', segments };
}

/** The search string for a query, with the defaults left out so the default view has a bare URL. */
export function serializeQuery(query: Query): string {
  const params = new URLSearchParams();
  if (query.preset !== null) {
    if (query.preset !== DEFAULT_PRESET) {
      params.set('range', query.preset);
    }
  } else {
    params.set('from', query.range.from);
    params.set('to', query.range.to);
  }
  if (query.compare) {
    params.set('compare', '1');
  }
  if (query.segments.length > 0) {
    params.set('seg', query.segments.map((segment) => `${segment.dimension}:${encodeURIComponent(segment.value)}`).join(','));
  }
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

/** The query with a segment added, replacing any earlier one on the same dimension. */
export function withSegment(query: Query, segment: Segment): Query {
  return { ...query, segments: [...query.segments.filter((existing) => existing.dimension !== segment.dimension), segment] };
}

/** The query without the segment on a dimension. */
export function withoutSegment(query: Query, dimension: Dimension): Query {
  return { ...query, segments: query.segments.filter((existing) => existing.dimension !== dimension) };
}

/** The segment on a dimension, if any. */
export function segmentOn(query: Query, dimension: Dimension): Segment | undefined {
  return query.segments.find((segment) => segment.dimension === dimension);
}
