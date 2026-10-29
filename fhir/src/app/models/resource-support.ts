import { ParamSupport } from './param-support';

/** Whether the sandbox supports one resource type the explorer needs, with its search parameters. */
export interface ResourceSupport {
  /** Patient, Condition, Observation, or Encounter. */
  readonly type: string;

  readonly supported: boolean;
  readonly searchParams: readonly ParamSupport[];
}
