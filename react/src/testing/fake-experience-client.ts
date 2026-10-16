import type { ExperienceClient } from '../app/interfaces/experience-client';
import type { Position } from '../app/models/position';
import type { PositionList } from '../app/models/position-list';
import type { SkillList } from '../app/models/skill-list';

/** Scriptable ExperienceClient. Each method runs the function a test assigns and records its arguments. */
export class FakeExperienceClient implements ExperienceClient {
  /** Skill arguments passed to getExperience(), in call order. */
  readonly experienceCalls: (string | null)[] = [];

  /** How many times getSkills() ran. */
  skillsCalls = 0;

  /** How many times getSeed() ran. */
  seedCalls = 0;

  /** Behaviour of getExperience(). */
  onGetExperience: (skill: string | null) => Promise<PositionList> = () =>
    Promise.resolve({ count: 0, items: [] });

  /** Behaviour of getSkills(). */
  onGetSkills: () => Promise<SkillList> = () => Promise.resolve({ count: 0, items: [] });

  /** Behaviour of getSeed(). */
  onGetSeed: () => Promise<readonly Position[]> = () => Promise.resolve([]);

  getExperience(skill: string | null): Promise<PositionList> {
    this.experienceCalls.push(skill);
    return this.onGetExperience(skill);
  }

  getSkills(): Promise<SkillList> {
    this.skillsCalls++;
    return this.onGetSkills();
  }

  getSeed(): Promise<readonly Position[]> {
    this.seedCalls++;
    return this.onGetSeed();
  }
}
