import { VitalComponent } from './vital-component';

/** One vital-sign `Observation`, selected by LOINC code. Either value and unit, or components, is present. */
export interface VitalSign {
  /** ISO 8601 date or date-time. */
  readonly date: string;

  readonly name: string;
  readonly loincCode: string;
  readonly value?: number;

  /** The UCUM unit as sent (`kg`, `mm[Hg]`, `/min`). */
  readonly unit?: string;

  readonly components?: readonly VitalComponent[];
}
