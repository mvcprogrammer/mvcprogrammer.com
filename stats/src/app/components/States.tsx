import type { DayKey } from '../dates';
import { formatDayWithYear } from '../formatters/format';

/** Props of ErrorState. */
export interface ErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
}

/** A failed fetch: the message and a retry button, never a blank page. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="state" role="alert">
      <h2>The data did not load</h2>
      <p>
        <code>{message}</code>
      </p>
      <button type="button" className="button button-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/** Props of EmptyRange. */
export interface EmptyRangeProps {
  readonly earliest?: DayKey;
  readonly latest?: DayKey;
  readonly onPick: (day: DayKey) => void;
}

/** A range with no day files: says so, with the earliest and latest available days as links. */
export function EmptyRange({ earliest, latest, onPick }: EmptyRangeProps) {
  return (
    <div className="state">
      <h2>No data for this range</h2>
      {earliest !== undefined && latest !== undefined ? (
        <>
          <p>Day files exist from {formatDayWithYear(earliest)} to {formatDayWithYear(latest)}.</p>
          <div className="day-links">
            <button type="button" onClick={() => onPick(earliest)}>
              Go to the earliest day
            </button>
            <button type="button" onClick={() => onPick(latest)}>
              Go to the latest day
            </button>
          </div>
        </>
      ) : (
        <p>No day files have been exported yet.</p>
      )}
    </div>
  );
}

/** The dashboard's shape while the first data loads, so nothing jumps. */
export function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="tiles">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="tile">
            <div className="skeleton" />
            <div className="skeleton is-value" />
            <div className="skeleton" />
          </div>
        ))}
      </div>
      <div className="panel panel-wide">
        <div className="skeleton is-chart" />
      </div>
      <div className="panel-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="panel">
            <div className="skeleton" />
            <div className="skeleton is-rows" />
          </div>
        ))}
      </div>
    </div>
  );
}
