import type { ReactNode } from 'react';
import { useId } from 'react';

/** Props of Panel. */
export interface PanelProps {
  readonly title: string;
  /** A short qualifier shown beside the title, for example "share of visits". */
  readonly note?: string;
  /** When set, the body is replaced by this text. */
  readonly empty?: string | null;
  /** Spans the full grid width. */
  readonly wide?: boolean;
  readonly children?: ReactNode;
}

/** A titled card in the breakdown grid. */
export function Panel({ title, note, empty = null, wide = false, children }: PanelProps) {
  const id = useId();
  return (
    <section className={`panel${wide ? ' panel-wide' : ''}`} aria-labelledby={id}>
      <div className="panel-head">
        <h2 id={id}>{title}</h2>
        {note !== undefined && <p className="panel-note">{note}</p>}
      </div>
      {empty !== null ? <p className="panel-empty">{empty}</p> : children}
    </section>
  );
}
