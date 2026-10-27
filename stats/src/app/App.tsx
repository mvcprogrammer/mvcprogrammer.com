import { useCallback, useEffect, useState } from 'react';
import { DateRangePicker } from './components/DateRangePicker';
import { EditionSwitcher } from './components/EditionSwitcher';
import { SegmentChips } from './components/SegmentChips';
import { ErrorState, LoadingSkeleton } from './components/States';
import { Updated } from './components/Updated';
import type { StatsClient } from './data/stats-client';
import type { Edition, StatsIndex } from './data/types';
import { todayKey, type DayKey } from './dates';
import { Dashboard } from './pages/Dashboard';
import { segmentOn, withSegment, withoutSegment } from './query/query';
import { useQuery } from './query/use-query';

/** Props of App. */
export interface AppProps {
  readonly client: StatsClient;
  /** Today in the site's time zone; defaults to now. Tests pin it. */
  readonly today?: DayKey;
}

type IndexPhase = { readonly kind: 'loading' } | { readonly kind: 'error'; readonly message: string } | { readonly kind: 'ready'; readonly index: StatsIndex };

/** The dashboard: a header with the controls, the active filters, and the page. The URL holds the state. */
export function App({ client, today = todayKey() }: AppProps) {
  const [query, setQuery] = useQuery(today);
  const [indexPhase, setIndexPhase] = useState<IndexPhase>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIndexPhase({ kind: 'loading' });
    client
      .loadIndex(controller.signal)
      .then((index) => {
        if (!controller.signal.aborted) {
          setIndexPhase({ kind: 'ready', index });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setIndexPhase({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
        }
      });
    return () => controller.abort();
  }, [client, attempt]);

  const onEdition = useCallback(
    (edition: Edition | null) => setQuery(edition === null ? withoutSegment(query, 'edition') : withSegment(query, { dimension: 'edition', value: edition })),
    [query, setQuery],
  );

  const index = indexPhase.kind === 'ready' ? indexPhase.index : null;
  const edition = (segmentOn(query, 'edition')?.value ?? null) as Edition | null;

  return (
    <div className="dash">
      <header className="dash-header">
        <a className="dash-brand" href="https://mvcprogrammer.com/">
          <span className="brand-mark" aria-hidden="true" />
          <h1>
            mvcprogrammer.com <span className="dash-brand-stats">· Stats</span>
          </h1>
        </a>
        <button type="button" className="button button-secondary filters-toggle" aria-expanded={filtersOpen} aria-controls="controls" onClick={() => setFiltersOpen((open) => !open)}>
          Filters
        </button>
        <div id="controls" className={`dash-controls${filtersOpen ? ' is-open' : ''}`}>
          <EditionSwitcher value={edition} onChange={onEdition} />
          <DateRangePicker range={query.range} preset={query.preset} today={today} earliest={index?.days[0]} onChange={(range, preset) => setQuery({ ...query, range, preset })} />
          <label className="switch">
            <input type="checkbox" checked={query.compare} onChange={(event) => setQuery({ ...query, compare: event.target.checked })} />
            <span className="switch-track" aria-hidden="true" />
            Compare
          </label>
          {index !== null && <Updated generatedAt={index.generatedAt} />}
        </div>
      </header>

      <main id="main">
        <SegmentChips segments={query.segments} onRemove={(dimension) => setQuery(withoutSegment(query, dimension))} onClear={() => setQuery({ ...query, segments: [] })} />
        {indexPhase.kind === 'loading' && <LoadingSkeleton />}
        {indexPhase.kind === 'error' && <ErrorState message={indexPhase.message} onRetry={() => setAttempt((count) => count + 1)} />}
        {index !== null && <Dashboard client={client} index={index} query={query} setQuery={setQuery} today={today} />}
      </main>

      <footer className="dash-footer">
        <span>Days are cut in Eastern time.</span>
        <span>A visit is a non-bot browser that loaded a page and at least one asset, API call, or ping, in 30-minute sessions; the owner's visits are excluded.</span>
        <span>Source: CloudFront access logs and the first-party beacon. No cookies, no third parties.</span>
      </footer>
    </div>
  );
}
