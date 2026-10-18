import { EDITION_LABELS, type Edition } from '../data/types';
import { countryName } from '../formatters/format';
import { DIMENSION_LABELS, type Dimension, type Segment } from '../query/query';

/** Props of SegmentChips. */
export interface SegmentChipsProps {
  readonly segments: readonly Segment[];
  readonly onRemove: (dimension: Dimension) => void;
  readonly onClear: () => void;
}

/** The value of a segment as a reader would say it. */
export function segmentValueLabel(segment: Segment): string {
  switch (segment.dimension) {
    case 'edition':
      return EDITION_LABELS[segment.value as Edition] ?? segment.value;
    case 'country':
      return countryName(segment.value);
    case 'screen':
    case 'scheme':
      return segment.value.charAt(0).toUpperCase() + segment.value.slice(1);
    case 'referrer':
      return segment.value;
  }
}

/** The active filters as removable chips. Renders nothing when there are none. */
export function SegmentChips({ segments, onRemove, onClear }: SegmentChipsProps) {
  if (segments.length === 0) {
    return null;
  }
  return (
    <ul className="chips" aria-label="Active filters">
      <li className="chips-label">Filters:</li>
      {segments.map((segment) => {
        const dimension = DIMENSION_LABELS[segment.dimension];
        const value = segmentValueLabel(segment);
        return (
          <li key={segment.dimension} className="chip">
            <span className="chip-dimension">{dimension}:</span> {value}
            <button type="button" onClick={() => onRemove(segment.dimension)} aria-label={`Remove filter ${dimension}: ${value}`}>
              <span aria-hidden="true">×</span>
            </button>
          </li>
        );
      })}
      {segments.length > 1 && (
        <li>
          <button type="button" className="chips-clear" onClick={onClear}>
            Clear all
          </button>
        </li>
      )}
    </ul>
  );
}
