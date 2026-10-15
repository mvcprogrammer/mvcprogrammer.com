import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SITE_OPTIONS } from '../configurations/site-options';
import { ExperienceClient } from '../interfaces/experience-client';
import { Position } from '../models/position';
import { PositionList } from '../models/position-list';
import { SkillList } from '../models/skill-list';

/** Experience API client over HttpClient. Paths are relative, so CloudFront routes /api on this origin to the Lambda. */
@Injectable()
export class HttpExperienceClient extends ExperienceClient {
  /** Every request gives up after this long; the seed file takes over. */
  static readonly TIMEOUT_MS = 15_000;

  private static readonly EMPTY_POSITIONS: PositionList = { count: 0, items: [] };
  private static readonly EMPTY_SKILLS: SkillList = { count: 0, items: [] };

  private readonly http = inject(HttpClient);
  private readonly options = inject(SITE_OPTIONS);

  /** @inheritdoc */
  override async getExperience(skill: string | null): Promise<PositionList> {
    let path = `${this.options.experienceApiBase}/experience`;
    if (skill !== null && skill.trim() !== '') {
      path += `?skill=${encodeURIComponent(skill)}`;
    }

    const list = await firstValueFrom(this.http.get<PositionList | null>(path, { timeout: HttpExperienceClient.TIMEOUT_MS }));
    return list ?? HttpExperienceClient.EMPTY_POSITIONS;
  }

  /** @inheritdoc */
  override async getSkills(): Promise<SkillList> {
    const path = `${this.options.experienceApiBase}/skills`;
    const list = await firstValueFrom(this.http.get<SkillList | null>(path, { timeout: HttpExperienceClient.TIMEOUT_MS }));
    return list ?? HttpExperienceClient.EMPTY_SKILLS;
  }

  /** @inheritdoc */
  override async getSeed(): Promise<readonly Position[]> {
    const seed = await firstValueFrom(
      this.http.get<readonly Position[] | null>(this.options.experienceSeedPath, { timeout: HttpExperienceClient.TIMEOUT_MS }),
    );
    return seed ?? [];
  }
}
