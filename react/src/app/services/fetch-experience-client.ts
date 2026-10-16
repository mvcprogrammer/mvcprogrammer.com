import type { SiteOptions } from '../configurations/site-options';
import { HttpStatusError } from '../exceptions/http-status-error';
import type { ExperienceClient } from '../interfaces/experience-client';
import type { Position } from '../models/position';
import type { PositionList } from '../models/position-list';
import type { SkillList } from '../models/skill-list';

/** Experience API client over fetch. Paths are relative, so CloudFront routes /api on this origin to the Lambda. */
export class FetchExperienceClient implements ExperienceClient {
  /** Every request gives up after this long; the seed file takes over. */
  static readonly TIMEOUT_MS = 15_000;

  private static readonly EMPTY_POSITIONS: PositionList = { count: 0, items: [] };
  private static readonly EMPTY_SKILLS: SkillList = { count: 0, items: [] };

  private readonly options: SiteOptions;
  private readonly fetch: typeof globalThis.fetch;

  /**
   * @param options The site endpoints; experienceApiBase and experienceSeedPath are used.
   * @param fetch The fetch function, the global one unless a test supplies another.
   */
  constructor(
    options: SiteOptions,
    fetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args),
  ) {
    this.options = options;
    this.fetch = fetch;
  }

  /** @inheritdoc */
  async getExperience(skill: string | null): Promise<PositionList> {
    let path = `${this.options.experienceApiBase}/experience`;
    if (skill !== null && skill.trim() !== '') {
      path += `?skill=${encodeURIComponent(skill)}`;
    }

    const list = await this.getJson<PositionList | null>(path);
    return list ?? FetchExperienceClient.EMPTY_POSITIONS;
  }

  /** @inheritdoc */
  async getSkills(): Promise<SkillList> {
    const list = await this.getJson<SkillList | null>(`${this.options.experienceApiBase}/skills`);
    return list ?? FetchExperienceClient.EMPTY_SKILLS;
  }

  /** @inheritdoc */
  async getSeed(): Promise<readonly Position[]> {
    const seed = await this.getJson<readonly Position[] | null>(this.options.experienceSeedPath);
    return seed ?? [];
  }

  /** GET with the timeout and JSON Accept header; a non-2xx status rejects with HttpStatusError, a non-JSON body with SyntaxError. */
  private async getJson<T>(path: string): Promise<T> {
    const response = await this.fetch(path, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FetchExperienceClient.TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new HttpStatusError(response.status, path);
    }

    return (await response.json()) as T;
  }
}
