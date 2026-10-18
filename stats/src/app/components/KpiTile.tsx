import { Sparkline } from './Sparkline';

/** Props of KpiTile. */
export interface KpiTileProps {
  readonly label: string;
  /** The formatted headline number. */
  readonly value: string;
  /** The formatted change against the compare period, or null to show nothing. */
  readonly delta?: string | null;
  /** Which way the change went, for color and the arrow; "flat" for no change or no compare. */
  readonly direction?: 'up' | 'down' | 'flat';
  /** Extra detail for the tooltip and screen readers. */
  readonly hint?: string;
  /** The last seven values, for the sparkline. */
  readonly spark?: readonly number[];
  /** Greyed out when the metric cannot exist for the range (for example beacon reach before the beacon shipped). */
  readonly muted?: boolean;
  /** True when the tile is still loading. */
  readonly loading?: boolean;
}

const ARROWS = { up: '▲', down: '▼', flat: '' } as const;

/** One headline number with its delta and sparkline. */
export function KpiTile({ label, value, delta = null, direction = 'flat', hint, spark, muted = false, loading = false }: KpiTileProps) {
  const title = hint === undefined ? undefined : hint;
  return (
    <article className={`tile${muted ? ' is-muted' : ''}`} title={title} aria-busy={loading || undefined}>
      <p className="tile-label">{label}</p>
      {loading ? (
        <div className="skeleton is-value" aria-hidden="true" />
      ) : (
        <p className="tile-value">
          {value}
          {hint !== undefined && <span className="sr-only">. {hint}</span>}
        </p>
      )}
      <p className={`tile-delta${direction === 'up' ? ' is-up' : direction === 'down' ? ' is-down' : ''}`}>
        {delta !== null && !loading && (
          <>
            <span aria-hidden="true">{ARROWS[direction]} </span>
            {delta}
            <span className="sr-only"> versus the previous period</span>
          </>
        )}
      </p>
      {spark !== undefined && !loading && <Sparkline values={spark} label={`${label}, last seven points`} />}
    </article>
  );
}
