import { Skill } from './skill';

/** Envelope returned by GET /api/skills. */
export interface SkillList {
  /** Number of items. */
  readonly count: number;

  /** Skills, most-used first. */
  readonly items: readonly Skill[];
}
