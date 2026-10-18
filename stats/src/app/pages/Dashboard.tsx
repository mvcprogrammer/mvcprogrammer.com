import { useCallback, useEffect, useMemo, useState } from 'react';
import { EMPTY_SUMMARY, delta, filterVisits, quantile, returningVisitors, share, splitClick, summarize, type Counts, type Summary } from '../aggregation/aggregate';
import { WEEKLY_FROM_DAYS, buildPreviousSeries, buildSeries, sparkline, type DayVisits } from '../aggregation/series';
import { Bars, type BarRow } from '../components/Bars';
import { Donut } from '../components/DonutPanel';
import { HourChart } from '../components/HourChart';
import { KpiTile } from '../components/KpiTile';
import { Panel } from '../components/Panel';
import { ScannerPanel } from '../components/ScannerPanel';
import { EmptyRange, ErrorState, LoadingSkeleton } from '../components/States';
import { TimeOnPageChart } from '../components/TimeOnPageChart';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import type { DayLoad, StatsClient } from '../data/stats-client';
import { EDITION_LABELS, SECTION_LABELS, type Edition, type StatsIndex } from '../data/types';
import { addDays, dayKeysBetween, previousPeriod, rangeLength, type DayKey, type DayRange } from '../dates';
import { countryName, flagOf, formatDayShort, formatDelta, formatDuration, formatNumber, formatPercent, formatPoints, formatRange } from '../formatters/format';
import { DIRECT, segmentOn, withSegment, withoutSegment, type Dimension, type Query } from '../query/query';

/** Props of Dashboard. */
export interface DashboardProps {
  readonly client: StatsClient;
  readonly index: StatsIndex;
  readonly query: Query;
  readonly setQuery: (next: Query) => void;
  readonly today: DayKey;
}

type Phase = { readonly kind: 'loading' } | { readonly kind: 'error'; readonly message: string } | { readonly kind: 'ready'; readonly current: DayLoad[]; readonly previous: DayLoad[] | null };

const PLACE_LABELS: Readonly<Record<string, string>> = { header: 'header menu', about: 'About chips', hero: 'hero', footer: 'footer', portfolio: 'Portfolio', page: 'page' };

function direction(change: number | null): 'up' | 'down' | 'flat' {
  if (change === null || Math.round(change * 100) === 0) {
    return 'flat';
  }
  return change > 0 ? 'up' : 'down';
}

function placeDetail(counts: Counts, prefix: string): string {
  const byPlace = new Map<string, number>();
  for (const [key, count] of Object.entries(counts)) {
    if (key.startsWith(prefix)) {
      const { place } = splitClick(key);
      byPlace.set(place, (byPlace.get(place) ?? 0) + count);
    }
  }
  return [...byPlace.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([place, count]) => `${PLACE_LABELS[place] ?? place} ${formatNumber(count)}`)
    .join(' · ');
}

function topRows(counts: Counts, whole: number, limit: number, label: (key: string) => string, glyph?: (key: string) => string): { rows: BarRow[]; others: string | null } {
  const entries = Object.entries(counts);
  const head = entries.slice(0, limit);
  const rest = entries.slice(limit);
  const rows: BarRow[] = head.map(([key, count]) => ({ key, label: label(key), count, share: share(count, whole), ...(glyph === undefined ? {} : { glyph: glyph(key) }) }));
  if (rest.length > 0) {
    const count = rest.reduce((sum, [, value]) => sum + value, 0);
    rows.push({ key: '(others)', label: `Others (${rest.length})`, count, share: share(count, whole), dim: true });
    return { rows, others: '(others)' };
  }
  return { rows, others: null };
}

/** The page below the header: tiles, the main chart, and the breakdown panels, all driven by the query. */
export function Dashboard({ client, index, query, setQuery, today }: DashboardProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const { range, compare, segments } = query;
  const available = useMemo(() => new Set(index.days), [index.days]);
  const previousRange = useMemo(() => previousPeriod(range), [range]);

  useEffect(() => {
    const controller = new AbortController();
    setPhase({ kind: 'loading' });
    const keysFor = (span: DayRange) => dayKeysBetween(span.from, span.to).filter((day) => available.has(day));
    Promise.all([client.loadDays(keysFor(range)), compare ? client.loadDays(keysFor(previousRange)) : Promise.resolve(null)])
      .then(([current, previous]) => {
        if (!controller.signal.aborted) {
          setPhase({ kind: 'ready', current, previous });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setPhase({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
        }
      });
    return () => controller.abort();
  }, [client, range, previousRange, compare, available, attempt]);

  // Clicking the row that is already the filter clears it, so the pressed buttons toggle.
  const select = useCallback(
    (dimension: Dimension, value: string) => setQuery(segmentOn(query, dimension)?.value === value ? withoutSegment(query, dimension) : withSegment(query, { dimension, value })),
    [query, setQuery],
  );
  const pickRange = useCallback((from: DayKey, to: DayKey) => setQuery({ ...query, preset: null, range: { from, to } }), [query, setQuery]);

  const view = useMemo(() => {
    if (phase.kind !== 'ready') {
      return null;
    }
    const toDayVisits = (loads: DayLoad[]): DayVisits[] => loads.map((load) => ({ day: load.day, file: load.file, visits: load.file === null ? [] : filterVisits(load.file.visits, segments) }));
    const current = toDayVisits(phase.current);
    const previous = phase.previous === null ? null : toDayVisits(phase.previous);
    const summary = summarize(current.flatMap((day) => day.visits));
    const previousSummary = previous === null ? null : summarize(previous.flatMap((day) => day.visits));
    const weekly = rangeLength(range) > WEEKLY_FROM_DAYS;
    const series = buildSeries(range, current);
    const previousSeries = previous === null ? null : buildPreviousSeries(range, previousRange, previous);
    const missing = dayKeysBetween(range.from, range.to).filter((day) => !available.has(day) && day <= today);
    return { current, summary, previousSummary, weekly, series, previousSeries, missing, returning: returningVisitors(current.map((day) => day.visits)) };
  }, [phase, segments, range, previousRange, available, today]);

  if (phase.kind === 'loading') {
    return <LoadingSkeleton />;
  }
  if (phase.kind === 'error') {
    return <ErrorState message={phase.message} onRetry={() => setAttempt((count) => count + 1)} />;
  }
  if (view === null) {
    return null;
  }
  const { summary, previousSummary, weekly, series, previousSeries, missing, returning } = view;
  const filesInRange = view.current.filter((day) => day.file !== null).length;
  if (filesInRange === 0) {
    const earliest = index.days[0];
    const latest = index.days[index.days.length - 1];
    return <EmptyRange earliest={earliest} latest={latest} onPick={(day) => pickRange(day, day)} />;
  }

  const prev: Summary = previousSummary ?? EMPTY_SUMMARY;
  const hasPrevious = previousSummary !== null;
  const beaconReach = share(summary.beaconReached, summary.visits);
  const previousReach = hasPrevious ? share(prev.beaconReached, prev.visits) : null;
  const median = quantile(summary.seconds, 0.5);
  const previousMedian = hasPrevious ? quantile(prev.seconds, 0.5) : null;
  const resumeTotal = Object.values(summary.resumeDownloads).reduce((sum, count) => sum + count, 0);
  const tile = (current: number, previous: number) => ({ delta: hasPrevious ? formatDelta(delta(current, previous)) : null, direction: hasPrevious ? direction(delta(current, previous)) : ('flat' as const) });

  const editionSegment = segmentOn(query, 'edition')?.value;
  const editions = topRows(summary.byEdition, summary.visits, 4, (key) => EDITION_LABELS[key as Edition] ?? key);
  const referrers = topRows(summary.byReferrer, summary.visits, 10, (key) => (key === DIRECT ? 'Direct or unknown' : key));
  const countries = topRows(summary.byCountry, summary.visits, 10, countryName, flagOf);
  const funnel: BarRow[] = Object.entries(summary.sectionReach).map(([key, count]) => ({ key, label: SECTION_LABELS[key] ?? key, count, share: share(count, summary.engaged) }));
  const editionClicks: BarRow[] = Object.entries(summary.byEdition)
    .map(([edition]) => edition)
    .filter((edition) => Object.keys(summary.clicks).some((key) => key.startsWith(`edition/${edition}/`)))
    .map((edition) => {
      const count = Object.entries(summary.clicks).filter(([key]) => key.startsWith(`edition/${edition}/`)).reduce((sum, [, value]) => sum + value, 0);
      return { key: edition, label: `To ${EDITION_LABELS[edition as Edition] ?? edition}`, count, share: share(count, summary.beaconReached), detail: placeDetail(summary.clicks, `edition/${edition}/`) };
    })
    .sort((a, b) => b.count - a.count);
  const profileTargets = new Map<string, number>();
  for (const [key, count] of Object.entries(summary.clicks)) {
    const { kind, target } = splitClick(key);
    if (kind === 'github' || kind === 'social') {
      profileTargets.set(`${kind}/${target}`, (profileTargets.get(`${kind}/${target}`) ?? 0) + count);
    }
  }
  const profileLabel = (kind: string, target: string) => {
    if (kind === 'github') {
      return target === 'profile' ? 'GitHub profile' : `GitHub: ${target}`;
    }
    return target === 'linkedin' ? 'LinkedIn' : target === 'flickr' ? 'Flickr' : target;
  };
  const profileRank = (key: string) => (key === 'github/profile' ? 0 : key.startsWith('github/') ? 1 : 2);
  const profileRows: BarRow[] = [...profileTargets.entries()]
    .map(([key, count]) => {
      const [kind = '', target = ''] = key.split('/');
      return { key, label: profileLabel(kind, target), count, share: share(count, summary.beaconReached), detail: placeDetail(summary.clicks, `${key}/`) };
    })
    .sort((a, b) => profileRank(a.key) - profileRank(b.key) || b.count - a.count);
  const skills = topRows(summary.skillClicks, summary.apiLoads, 8, (key) => key);

  return (
    <>
      <div className="range-summary">
        <span>
          <strong>{formatRange(range.from, range.to)}</strong> · {formatNumber(rangeLength(range))} days
          {hasPrevious && <> · compared with {formatRange(previousRange.from, previousRange.to)}</>}
        </span>
        <span>
          Returning visitors <strong>{formatNumber(returning)}</strong>
        </span>
        {missing.length > 0 && (
          <span className="missing-note">
            No file for {formatNumber(missing.length)} {missing.length === 1 ? 'day' : 'days'}: {missing.slice(0, 5).map(formatDayShort).join(', ')}
            {missing.length > 5 ? ', …' : ''} (shaded on the chart)
          </span>
        )}
      </div>

      <div className="tiles">
        <KpiTile label="Visitors" value={formatNumber(summary.visitors)} spark={sparkline(series, (p) => p.visitors)} hint={`${formatNumber(returning)} seen on more than one day`} {...tile(summary.visitors, prev.visitors)} />
        <KpiTile label="Visits" value={formatNumber(summary.visits)} spark={sparkline(series, (p) => p.visits)} {...tile(summary.visits, prev.visits)} />
        <KpiTile
          label="Beacon reach"
          value={formatPercent(beaconReach)}
          spark={sparkline(series, (p) => (p.beaconReach === null ? null : p.beaconReach * 100))}
          hint={`${formatNumber(summary.beaconReached)} of ${formatNumber(summary.visits)} visits sent a ping, so the script ran`}
          muted={summary.beaconReached === 0}
          delta={hasPrevious ? formatPoints(beaconReach, previousReach) : null}
          direction={hasPrevious && beaconReach !== null && previousReach !== null ? direction(beaconReach - previousReach) : 'flat'}
        />
        <KpiTile
          label="Time on page"
          value={formatDuration(median)}
          spark={sparkline(series, (p) => p.medianSeconds)}
          hint={`Median of ${formatNumber(summary.seconds.length)} visits · 75th percentile ${formatDuration(quantile(summary.seconds, 0.75))}`}
          muted={summary.seconds.length === 0}
          delta={hasPrevious ? formatDelta(delta(median, previousMedian)) : null}
          direction={hasPrevious ? direction(delta(median, previousMedian)) : 'flat'}
        />
        <KpiTile
          label="Edition clicks"
          value={formatNumber(summary.editionClickVisits)}
          spark={sparkline(series, (p) => p.editionClicks)}
          hint={`${formatPercent(share(summary.editionClickVisits, summary.beaconReached))} of beacon-reached visits switched edition`}
          {...tile(summary.editionClickVisits, prev.editionClickVisits)}
        />
        <KpiTile
          label="GitHub clicks"
          value={formatNumber(summary.githubClickVisits)}
          hint={`${formatNumber(summary.githubProfileClicks)} to the profile, ${formatNumber(summary.githubRepoClicks)} to repositories`}
          {...tile(summary.githubClickVisits, prev.githubClickVisits)}
        />
        {resumeTotal > 0 && (
          <KpiTile
            label="Resume downloads"
            value={formatNumber(resumeTotal)}
            hint={Object.entries(summary.resumeDownloads)
              .map(([edition, count]) => `${edition} ${formatNumber(count)}`)
              .join(', ')}
            {...tile(resumeTotal, Object.values(prev.resumeDownloads).reduce((sum, count) => sum + count, 0))}
          />
        )}
      </div>

      <Panel title={weekly ? 'Per week' : 'Per day'} note={compare ? 'previous period dashed' : 'click a point to zoom in'} wide>
        <TimeSeriesChart
          points={series}
          previous={previousSeries}
          weekly={weekly}
          onPick={(key) => {
            if (!weekly) {
              pickRange(key, key);
              return;
            }
            const from = key < range.from ? range.from : key;
            const end = addDays(key, 6);
            pickRange(from, end < range.to ? end : range.to);
          }}
        />
      </Panel>

      <div className="panel-grid">
        <Panel title="Editions" note="visits that loaded each" empty={summary.visits === 0 ? 'No visits in this range' : null}>
          <Bars rows={editions.rows} onSelect={(key) => select('edition', key)} selectedKey={editionSegment} />
        </Panel>
        <Panel title="Referrers" note="share of visits" empty={summary.visits === 0 ? 'No visits in this range' : null}>
          <Bars rows={referrers.rows} onSelect={(key) => select('referrer', key)} selectedKey={segmentOn(query, 'referrer')?.value} unselectable={new Set(referrers.others === null ? [] : [referrers.others])} />
        </Panel>
        <Panel title="Screens and color scheme" note="of visits that sent a load ping" empty={summary.beaconLoads === 0 ? 'No beacon data in this range' : null}>
          <div className="donuts">
            <Donut title="Screens" counts={summary.byScreen} dimension="screen" onSelect={select} selected={segmentOn(query, 'screen')?.value} />
            <Donut title="Color scheme" counts={summary.byScheme} dimension="scheme" onSelect={select} selected={segmentOn(query, 'scheme')?.value} />
          </div>
        </Panel>
        <Panel title="Countries" note="served from, by edge location" empty={summary.visits === 0 ? 'No visits in this range' : null}>
          <Bars rows={countries.rows} onSelect={(key) => select('country', key)} selectedKey={segmentOn(query, 'country')?.value} unselectable={new Set(countries.others === null ? [] : [countries.others])} />
        </Panel>
        <Panel title="Reading funnel" note={`share of ${formatNumber(summary.engaged)} engaged visits`} empty={summary.engaged === 0 ? 'No section views in this range' : null}>
          <Bars rows={funnel} />
        </Panel>
        <Panel title="Time on page" empty={summary.seconds.length === 0 ? 'No time-on-page data in this range' : null}>
          <TimeOnPageChart seconds={summary.seconds} />
        </Panel>
        <Panel title="Edition clicks" note="by target, with where the link was" empty={editionClicks.length === 0 ? 'No edition clicks in this range' : null}>
          <Bars rows={editionClicks} />
        </Panel>
        <Panel title="GitHub and profile clicks" note="share of beacon-reached visits" empty={profileRows.length === 0 ? 'No profile clicks in this range' : null}>
          <Bars rows={profileRows} />
        </Panel>
        <Panel title="Time of day" note="visit starts, America/New_York" empty={summary.visits === 0 ? 'No visits in this range' : null}>
          <HourChart byHour={summary.byHour} />
        </Panel>
        <Panel title="Experience API" note={`${formatPercent(share(summary.apiLoads, summary.visits))} of visits loaded it`} empty={summary.apiLoads === 0 ? 'No API calls in this range' : null}>
          {skills.rows.length > 0 ? <Bars rows={skills.rows} /> : <p className="panel-empty">No skill filter clicks</p>}
        </Panel>
      </div>

      <ScannerPanel points={series} weekly={weekly} />
    </>
  );
}
