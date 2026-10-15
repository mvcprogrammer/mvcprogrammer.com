import { WorkMode } from '../app/enumerations/work-mode';
import { Position } from '../app/models/position';
import { PositionList } from '../app/models/position-list';
import { Skill } from '../app/models/skill';
import { SkillList } from '../app/models/skill-list';

/** A position with sensible defaults; override what the test cares about. */
export function createPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'advancedmd',
    title: 'Senior Software Engineer',
    organization: 'AdvancedMD',
    startDate: '2023-12',
    endDate: '2026-05',
    workMode: WorkMode.Remote,
    location: 'Remote',
    highlights: ['Did the work.'],
    skills: ['C#'],
    ...overrides,
  };
}

/** Two positions, newest first, as the API returns them. */
export function createPositionList(): PositionList {
  const items = [
    createPosition(),
    createPosition({
      id: 'tops',
      title: 'Software Engineer',
      organization: 'TOPS Software',
      startDate: '2020-02',
      endDate: '2022-08',
      workMode: WorkMode.OnSite,
      location: 'Florida',
    }),
  ];
  return { count: items.length, items };
}

/** A skill list with the given names, each used by one position. */
export function createSkillList(...names: string[]): SkillList {
  const items: Skill[] = names.map((name) => ({ name, positionCount: 1, positionIds: ['advancedmd'] }));
  return { count: items.length, items };
}
