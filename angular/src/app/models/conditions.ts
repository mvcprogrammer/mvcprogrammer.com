import { ConditionItem } from './condition-item';

/** A patient's conditions split on clinical status. */
export interface Conditions {
  /** Active, recurrence, or relapse; newest onset first. */
  readonly active: readonly ConditionItem[];

  /** Inactive, remission, or resolved; the card collapses these into a count. */
  readonly resolved: readonly ConditionItem[];
}
