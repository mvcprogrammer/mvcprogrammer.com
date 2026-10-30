import { ConditionItem } from './condition-item';
import { Trace } from './trace';

/** What a condition write returns: the condition as the summary would now show it, with its id, and the trace of the upstream calls. Mirrors ConditionWriteResult in openapi.yaml. */
export interface ConditionWriteResult {
  readonly condition: ConditionItem;
  readonly trace: Trace;
}
