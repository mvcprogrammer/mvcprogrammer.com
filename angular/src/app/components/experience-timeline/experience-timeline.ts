import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, PendingTasks, computed, inject, signal } from '@angular/core';
import { SITE_OPTIONS } from '../../configurations/site-options';
import { ExperienceClient } from '../../interfaces/experience-client';
import { Position } from '../../models/position';
import { Skill } from '../../models/skill';
import { MonthLabelPipe } from '../../pipes/month-label';
import { PlaceLabelPipe } from '../../pipes/place-label';

/** Experience timeline: loads positions and skills, applies the skill filter, falls back to the seed. */
@Component({
  selector: 'app-experience-timeline',
  imports: [MonthLabelPipe, PlaceLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './experience-timeline.html',
})
export class ExperienceTimeline implements OnInit, OnDestroy {
  /** Chips shown before the "+N more" button. */
  static readonly VISIBLE_CHIPS = 12;

  /** Chips named here lead the row in this order, regardless of position count. */
  static readonly PINNED_SKILLS: readonly string[] = ['ASP.NET Web API', 'C#', 'Claude Pair Programming', 'Angular', 'React'];

  /** Chips named here go to the end of the row. */
  static readonly DEMOTED_SKILLS: readonly string[] = ['CloudWatch'];

  protected readonly options = inject(SITE_OPTIONS);
  protected readonly positions = signal<readonly Position[]>([]);
  protected readonly skills = signal<readonly Skill[] | null>(null);
  protected readonly selectedSkill = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly allChipsShown = signal(false);
  protected readonly failed = signal(false);

  protected readonly countLabel = computed(() => {
    const skill = this.selectedSkill();
    return this.positionsLabel(this.positions().length) + (skill === null ? '' : ` with ${skill}`);
  });

  protected readonly jsonPath = computed(() => {
    const skill = this.selectedSkill();
    return `/${this.options.experienceApiBase}/experience` + (skill === null ? '' : `?skill=${encodeURIComponent(skill)}`);
  });

  protected readonly hiddenChipCount = computed(() => {
    const skills = this.skills();
    return skills === null || this.allChipsShown() ? 0 : Math.max(0, skills.length - ExperienceTimeline.VISIBLE_CHIPS);
  });

  private readonly client = inject(ExperienceClient);
  private readonly pendingTasks = inject(PendingTasks);
  private allPositions: readonly Position[] = [];
  private destroyed = false;

  /** @inheritdoc */
  ngOnInit(): void {
    void this.pendingTasks.run(() => this.load());
  }

  /** @inheritdoc */
  ngOnDestroy(): void {
    // A response that arrives after this point is dropped rather than applied to a dead view.
    this.destroyed = true;
  }

  protected positionsLabel(count: number): string {
    return count === 1 ? '1 position' : `${count} positions`;
  }

  protected isPressed(skill: string | null): boolean {
    return this.selectedSkill() === skill;
  }

  protected isChipHidden(index: number): boolean {
    return !this.allChipsShown() && index >= ExperienceTimeline.VISIBLE_CHIPS;
  }

  protected showAllChips(): void {
    this.allChipsShown.set(true);
  }

  /** Filters the timeline to one skill, or restores every position for null without another request. */
  protected select(skill: string | null): void {
    void this.pendingTasks.run(() => this.filter(skill));
  }

  private async load(): Promise<void> {
    try {
      const list = await this.client.getExperience(null);
      if (list.items.length === 0) {
        throw new Error('The API returned no positions.');
      }

      if (this.destroyed) {
        return;
      }

      this.allPositions = list.items;
      this.positions.set(list.items);

      const skills = await this.client.getSkills();
      if (this.destroyed) {
        return;
      }

      if (skills.items.length > 0) {
        this.skills.set(ExperienceTimeline.orderChips(skills.items));
      }
    } catch {
      // Any failure (network, status, HTML instead of JSON, timeout) leaves the API behind.
      if (!this.destroyed && this.positions().length === 0) {
        await this.loadSeed();
      }
    }
  }

  private async loadSeed(): Promise<void> {
    try {
      const seed = await this.client.getSeed();
      if (this.destroyed) {
        return;
      }

      this.allPositions = seed;
      this.positions.set(seed);
      this.failed.set(seed.length === 0);
    } catch {
      if (!this.destroyed) {
        this.failed.set(true);
      }
    }
  }

  private async filter(skill: string | null): Promise<void> {
    this.loading.set(true);
    try {
      const positions = skill === null ? this.allPositions : (await this.client.getExperience(skill)).items;
      if (this.destroyed) {
        return;
      }

      this.positions.set(positions);
      this.selectedSkill.set(skill);
    } catch {
      if (!this.destroyed) {
        this.positions.set(this.allPositions);
        this.selectedSkill.set(null);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private static orderChips(skills: readonly Skill[]): readonly Skill[] {
    const byName = (name: string): readonly Skill[] => skills.filter((skill) => skill.name === name);
    const pinned = ExperienceTimeline.PINNED_SKILLS.flatMap(byName);
    const demoted = ExperienceTimeline.DEMOTED_SKILLS.flatMap(byName);
    const rest = skills.filter(
      (skill) => !ExperienceTimeline.PINNED_SKILLS.includes(skill.name) && !ExperienceTimeline.DEMOTED_SKILLS.includes(skill.name),
    );
    return [...pinned, ...rest, ...demoted];
  }
}
