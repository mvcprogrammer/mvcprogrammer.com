import { formatNumber, formatPercent } from '../formatters/format';

/** One row of a bars list. */
export interface BarRow {
  /** The value a click filters on. */
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /** Share of the panel's whole, or null when the whole is zero. */
  readonly share: number | null;
  /** A glyph before the label, for example a flag. */
  readonly glyph?: string;
  /** A second line under the bar. */
  readonly detail?: string;
  /** Drawn in the secondary color (the "Others" row). */
  readonly dim?: boolean;
}

/** Props of Bars. */
export interface BarsProps {
  readonly rows: readonly BarRow[];
  /** Called with the row key when a row is clicked; rows are plain text when absent. */
  readonly onSelect?: (key: string) => void;
  /** The key of the row that is the active filter. */
  readonly selectedKey?: string;
  /** Rows that cannot be selected even when onSelect is set (for example "Others"). */
  readonly unselectable?: ReadonlySet<string>;
  /** What a click does, for the button's accessible name. */
  readonly selectVerb?: string;
}

/** A list of labelled horizontal bars. The bar is an SVG whose width is an attribute, not a style. */
export function Bars({ rows, onSelect, selectedKey, unselectable, selectVerb = 'Filter by' }: BarsProps) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <ul className="bars">
      {rows.map((row) => {
        const width = Math.max(0, Math.min(100, (row.count / max) * 100));
        const selectable = onSelect !== undefined && !(unselectable?.has(row.key) ?? false);
        return (
          <li key={row.key} className={`bar-row${row.key === selectedKey ? ' is-selected' : ''}${row.dim ? ' is-dim' : ''}`}>
            {selectable ? (
              <button type="button" onClick={() => onSelect(row.key)} aria-pressed={row.key === selectedKey} aria-label={`${selectVerb} ${row.label}`}>
                {row.glyph !== undefined && <span className="flag" aria-hidden="true">{row.glyph}</span>}
                {row.label}
              </button>
            ) : (
              <span className="bar-label">
                {row.glyph !== undefined && <span className="flag" aria-hidden="true">{row.glyph}</span>}
                {row.label}
              </span>
            )}
            <span className="bar-count">
              <strong>{formatNumber(row.count)}</strong>
              {row.share !== null && <> · {formatPercent(row.share)}</>}
            </span>
            <svg className="bar-track" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <rect className="bar-rail" x="0" y="0" width="100" height="1" />
              <rect x="0" y="0" width={width.toFixed(2)} height="1" />
            </svg>
            {row.detail !== undefined && <span className="bar-detail">{row.detail}</span>}
          </li>
        );
      })}
    </ul>
  );
}
