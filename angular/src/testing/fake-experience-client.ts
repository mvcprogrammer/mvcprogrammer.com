import { ExperienceClient } from '../app/interfaces/experience-client';
import { Position } from '../app/models/position';
import { PositionList } from '../app/models/position-list';
import { SkillList } from '../app/models/skill-list';

/** Scriptable ExperienceClient. Each method runs the function a test assigns and records its arguments. */
export class FakeExperienceClient extends ExperienceClient {
  /** Skill arguments passed to getExperience(), in call order. */
  readonly experienceCalls: (string | null)[] = [];

  /** How many times getSkills() ran. */
  skillsCalls = 0;

  /** How many times getSeed() ran. */
  seedCalls = 0;

  /** Behaviour of getExperience(). */
  onGetExperience: (skill: string | null) => Promise<PositionList> = () => Promise.resolve({ count: 0, items: [] });

  /** Behaviour of getSkills(). */
  onGetSkills: () => Promise<SkillList> = () => Promise.resolve({ count: 0, items: [] });

  /** Behaviour of getSeed(). */
  onGetSeed: () => Promise<readonly Position[]> = () => Promise.resolve([]);

  override getExperience(skill: string | null): Promise<PositionList> {
    this.experienceCalls.push(skill);
    return this.onGetExperience(skill);
  }

  override getSkills(): Promise<SkillList> {
    this.skillsCalls++;
    return this.onGetSkills();
  }

  override getSeed(): Promise<readonly Position[]> {
    this.seedCalls++;
    return this.onGetSeed();
  }
}
