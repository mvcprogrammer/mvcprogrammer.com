import { EDITIONS, EDITION_LABELS, type Edition } from '../data/types';

/** Props of EditionSwitcher. */
export interface EditionSwitcherProps {
  /** The edition in the filter, or null for all. */
  readonly value: Edition | null;
  readonly onChange: (edition: Edition | null) => void;
}

/** All plus the four editions as a segmented control; the edition filter you reach for most. */
export function EditionSwitcher({ value, onChange }: EditionSwitcherProps) {
  return (
    <div className="segmented" role="group" aria-label="Edition">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)}>
        All
      </button>
      {EDITIONS.map((edition) => (
        <button key={edition} type="button" aria-pressed={value === edition} onClick={() => onChange(edition)}>
          {EDITION_LABELS[edition]}
        </button>
      ))}
    </div>
  );
}
