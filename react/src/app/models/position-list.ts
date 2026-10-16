import type { Position } from './position';

/** Envelope returned by GET /api/experience. */
export interface PositionList {
  /** Number of items. */
  readonly count: number;

  /** Positions, newest first. */
  readonly items: readonly Position[];
}
