import { useId, useState } from 'react';
import type { DayKey, DayRange } from '../dates';
import { PRESET_LABELS, RANGE_PRESETS, resolvePreset, type RangePreset } from '../query/query';

/** Props of DateRangePicker. */
export interface DateRangePickerProps {
  readonly range: DayRange;
  /** The preset the range came from, or null for a custom range. */
  readonly preset: RangePreset | null;
  readonly today: DayKey;
  /** The earliest day with data, to bound the custom inputs. */
  readonly earliest?: DayKey;
  readonly onChange: (range: DayRange, preset: RangePreset | null) => void;
}

const CUSTOM = 'custom';

/** The named ranges in a select, with two date inputs for a custom range. */
export function DateRangePicker({ range, preset, today, earliest, onChange }: DateRangePickerProps) {
  const id = useId();
  const [custom, setCustom] = useState(preset === null);
  const showCustom = custom || preset === null;

  const onPreset = (value: string) => {
    if (value === CUSTOM) {
      setCustom(true);
      return;
    }
    setCustom(false);
    const chosen = value as RangePreset;
    onChange(resolvePreset(chosen, today), chosen);
  };

  const onCustom = (from: string, to: string) => {
    if (from !== '' && to !== '' && from <= to) {
      onChange({ from, to }, null);
    }
  };

  return (
    <div className="control" role="group" aria-label="Date range">
      <label className="control-label" htmlFor={`${id}-preset`}>
        Range
      </label>
      <select id={`${id}-preset`} value={showCustom ? CUSTOM : (preset ?? CUSTOM)} onChange={(event) => onPreset(event.target.value)}>
        {RANGE_PRESETS.map((option) => (
          <option key={option} value={option}>
            {PRESET_LABELS[option]}
          </option>
        ))}
        <option value={CUSTOM}>Custom</option>
      </select>
      {showCustom && (
        <>
          <label className="sr-only" htmlFor={`${id}-from`}>
            From
          </label>
          <input id={`${id}-from`} type="date" value={range.from} min={earliest} max={range.to} onChange={(event) => onCustom(event.target.value, range.to)} />
          <span aria-hidden="true">–</span>
          <label className="sr-only" htmlFor={`${id}-to`}>
            To
          </label>
          <input id={`${id}-to`} type="date" value={range.to} min={range.from} max={today} onChange={(event) => onCustom(range.from, event.target.value)} />
        </>
      )}
    </div>
  );
}
