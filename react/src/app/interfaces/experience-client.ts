import type { Position } from '../models/position';
import type { PositionList } from '../models/position-list';
import type { SkillList } from '../models/skill-list';

/** Reads the Experience API, with the bundled seed file as the offline fallback. */
export interface ExperienceClient {
  /**
   * GET /api/experience, optionally filtered to positions that list a skill.
   * @param skill Skill name to filter by, or null for every position.
   */
  getExperience(skill: string | null): Promise<PositionList>;

  /** GET /api/skills: every skill with the number of positions that list it. */
  getSkills(): Promise<SkillList>;

  /** The copy of api/seed/positions.json published with the site, for when the API is unreachable. */
  getSeed(): Promise<readonly Position[]>;
}
