import { Position } from '../models/position';
import { PositionList } from '../models/position-list';
import { SkillList } from '../models/skill-list';

/**
 * Reads the Experience API, with the bundled seed file as the offline fallback. An abstract class
 * rather than an interface so it can serve as the injection token.
 */
export abstract class ExperienceClient {
  /**
   * GET /api/experience, optionally filtered to positions that list a skill.
   * @param skill Skill name to filter by, or null for every position.
   */
  abstract getExperience(skill: string | null): Promise<PositionList>;

  /** GET /api/skills: every skill with the number of positions that list it. */
  abstract getSkills(): Promise<SkillList>;

  /** The copy of api/seed/positions.json published with the site, for when the API is unreachable. */
  abstract getSeed(): Promise<readonly Position[]>;
}
