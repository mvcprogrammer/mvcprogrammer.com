import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkMode } from '../../enumerations/work-mode';
import { PositionList } from '../../models/position-list';
import { SkillList } from '../../models/skill-list';
import { ExperienceTimeline } from './experience-timeline';
import { createSiteTestServices, textOf } from '../../../testing/site-testing';
import { FakeExperienceClient } from '../../../testing/fake-experience-client';
import { createPosition, createPositionList, createSkillList } from '../../../testing/test-data';

describe('ExperienceTimeline', () => {
  let client: FakeExperienceClient;
  let fixture: ComponentFixture<ExperienceTimeline>;
  let host: HTMLElement;

  beforeEach(async () => {
    const services = createSiteTestServices();
    client = services.experience;
    await TestBed.configureTestingModule({ imports: [ExperienceTimeline], providers: services.providers }).compileComponents();
  });

  describe('ngOnInit', () => {
    it('should render positions and the skill filter from the API', async () => {
      // Arrange
      arrangeApiAnswers(createPositionList(), createSkillList('C#', 'Angular'));

      // Act
      await render();

      // Assert
      expect(host.querySelectorAll('.timeline-item').length).toBe(2);
      expect(filter().hidden).toBe(false);
      expect(chipLabels()).toEqual(['All', 'C#', 'Angular']);
      expect(host.querySelector('.skill-filter-count')?.textContent).toBe('2 positions');
      expect(host.querySelector('.skill-filter-link')?.getAttribute('href')).toBe('/api/experience');
      expect(client.experienceCalls).toEqual([null]);
      expect(client.skillsCalls).toBe(1);
      expect(client.seedCalls).toBe(0);
    });

    it('should transform dates and the place label', async () => {
      // Arrange
      const current = createPosition({ endDate: null });
      const onSite = createPosition({ id: 'tops', startDate: '2020-02', endDate: '2022-08', workMode: WorkMode.OnSite, location: 'Florida' });
      arrangeApiAnswers({ count: 2, items: [current, onSite] }, createSkillList('C#'));

      // Act
      await render();

      // Assert
      const dates = Array.from(host.querySelectorAll('.timeline-date')).map(textOf);
      expect(dates).toEqual(['Dec 2023 – Present · Remote', 'Feb 2020 – Aug 2022 · Florida']);
      expect(host.querySelector('time')?.getAttribute('datetime')).toBe('2023-12');
      expect(host.querySelector('.timeline-item h3')?.textContent).toBe('Senior Software Engineer');
      expect(host.querySelector('.timeline-points li')?.textContent).toBe('Did the work.');
    });

    it('should fall back to the seed when the API fails', async () => {
      // Arrange
      arrangeApiFails(new Error('down'));

      // Act
      await render();

      // Assert
      expect(host.querySelectorAll('.timeline-item').length).toBe(1);
      expect(filter().hidden).toBe(true);
      expect(client.seedCalls).toBe(1);
      expect(host.querySelector('.form-status')).toBeNull();
    });

    it('should fall back to the seed when the API returns no positions', async () => {
      // Arrange
      arrangeApiAnswers({ count: 0, items: [] }, createSkillList('C#'));

      // Act
      await render();

      // Assert
      expect(host.querySelectorAll('.timeline-item').length).toBe(1);
      expect(client.seedCalls).toBe(1);
      expect(client.skillsCalls).toBe(0);
    });

    it('should fall back to the seed when the API answers with something that is not a list, as a host serving HTML does', async () => {
      // Arrange
      client.onGetExperience = () => Promise.resolve('<!DOCTYPE html><html></html>' as unknown as PositionList);
      client.onGetSeed = () => Promise.resolve([createPosition()]);

      // Act
      await render();

      // Assert
      expect(host.querySelectorAll('.timeline-item').length).toBe(1);
      expect(client.seedCalls).toBe(1);
      expect(client.skillsCalls).toBe(0);
    });

    it('should keep the API positions when only the skills request fails', async () => {
      // Arrange
      arrangeApiAnswers(createPositionList(), createSkillList('C#'));
      client.onGetSkills = () => Promise.reject(new Error('down'));

      // Act
      await render();

      // Assert
      expect(host.querySelectorAll('.timeline-item').length).toBe(2);
      expect(filter().hidden).toBe(true);
      expect(client.seedCalls).toBe(0);
    });

    it('should show the error with the resume link when the seed fails too', async () => {
      // Arrange
      arrangeApiFails(new Error('down'));
      client.onGetSeed = () => Promise.reject(new Error('also down'));

      // Act
      await render();

      // Assert
      expect(host.querySelectorAll('.timeline-item').length).toBe(0);
      const status = host.querySelector('.form-status.is-error');
      expect(status).not.toBeNull();
      expect(status?.querySelector('a')?.getAttribute('href')).toBe('https://resume.example.test/');
    });

    it('should show the error when the seed is empty', async () => {
      // Arrange
      arrangeApiFails(new Error('down'));
      client.onGetSeed = () => Promise.resolve([]);

      // Act
      await render();

      // Assert
      expect(host.querySelector('.form-status.is-error')).not.toBeNull();
    });

    it('should hide the filter when the skill list is empty', async () => {
      // Arrange
      arrangeApiAnswers(createPositionList(), { count: 0, items: [] });

      // Act
      await render();

      // Assert
      expect(host.querySelectorAll('.timeline-item').length).toBe(2);
      expect(filter().hidden).toBe(true);
    });
  });

  describe('skill chips', () => {
    it('should order chips pinned first, then the rest in API order, then demoted', async () => {
      // Arrange
      arrangeApiAnswers(createPositionList(), createSkillList('CloudWatch', 'SQL Server', 'Angular', 'AWS', 'C#'));

      // Act
      await render();

      // Assert
      expect(chipLabels()).toEqual(['All', 'C#', 'Angular', 'SQL Server', 'AWS', 'CloudWatch']);
    });

    it('should hide chips past twelve behind a more button that reveals them', async () => {
      // Arrange
      const names = Array.from({ length: 15 }, (_, i) => `Skill ${String(i + 1).padStart(2, '0')}`);
      arrangeApiAnswers(createPositionList(), createSkillList(...names));
      await render();
      expect(host.querySelector('.skill-chip-more')?.textContent).toBe('+3 more');
      expect(host.querySelectorAll('.skill-chip[hidden]').length).toBe(3);

      // Act
      host.querySelector<HTMLButtonElement>('.skill-chip-more')?.click();
      await fixture.whenStable();

      // Assert
      expect(host.querySelectorAll('.skill-chip[hidden]').length).toBe(0);
      expect(host.querySelector('.skill-chip-more')).toBeNull();
    });

    it('should title each chip with its position count', async () => {
      // Arrange
      const skills: SkillList = {
        count: 2,
        items: [
          { name: 'C#', positionCount: 2, positionIds: ['a', 'b'] },
          { name: 'Angular', positionCount: 1, positionIds: ['a'] },
        ],
      };
      arrangeApiAnswers(createPositionList(), skills);

      // Act
      await render();

      // Assert
      const chips = host.querySelectorAll('.skill-chip');
      expect(chips[1].getAttribute('title')).toBe('2 positions');
      expect(chips[2].getAttribute('title')).toBe('1 position');
    });
  });

  describe('select', () => {
    it('should filter by skill, press the chip, and update the count and link', async () => {
      // Arrange
      arrangeApiAnswers(createPositionList(), createSkillList('C#', 'Angular'));
      client.onGetExperience = (skill) =>
        Promise.resolve(skill === null ? createPositionList() : { count: 1, items: [createPosition({ skills: [skill] })] });
      await render();

      // Act
      chips()[1].click();
      await fixture.whenStable();

      // Assert
      expect(host.querySelectorAll('.timeline-item').length).toBe(1);
      expect(client.experienceCalls).toEqual([null, 'C#']);
      expect(chips()[1].getAttribute('aria-pressed')).toBe('true');
      expect(chips()[0].getAttribute('aria-pressed')).toBe('false');
      expect(host.querySelector('.skill-filter-count')?.textContent).toBe('1 position with C#');
      expect(host.querySelector('.skill-filter-link')?.getAttribute('href')).toBe('/api/experience?skill=C%23');
      expect(host.querySelector('.timeline')?.classList.contains('is-loading')).toBe(false);
    });

    it('should restore every position for All without another request', async () => {
      // Arrange
      arrangeApiAnswers(createPositionList(), createSkillList('C#'));
      client.onGetExperience = (skill) => Promise.resolve(skill === null ? createPositionList() : { count: 1, items: [createPosition()] });
      await render();
      chips()[1].click();
      await fixture.whenStable();
      expect(host.querySelectorAll('.timeline-item').length).toBe(1);

      // Act
      chips()[0].click();
      await fixture.whenStable();

      // Assert
      expect(host.querySelectorAll('.timeline-item').length).toBe(2);
      expect(client.experienceCalls).toEqual([null, 'C#']);
      expect(chips()[0].getAttribute('aria-pressed')).toBe('true');
      expect(host.querySelector('.skill-filter-link')?.getAttribute('href')).toBe('/api/experience');
    });

    it('should fall back to every position with All pressed when the filter request fails', async () => {
      // Arrange
      arrangeApiAnswers(createPositionList(), createSkillList('C#'));
      await render();
      client.onGetExperience = () => Promise.reject(new Error('down'));

      // Act
      chips()[1].click();
      await fixture.whenStable();

      // Assert
      expect(host.querySelectorAll('.timeline-item').length).toBe(2);
      expect(chips()[0].getAttribute('aria-pressed')).toBe('true');
      expect(host.querySelector('.skill-filter-count')?.textContent).toBe('2 positions');
    });
  });

  describe('ngOnDestroy', () => {
    it('should drop a response that arrives after the component is destroyed', async () => {
      // Arrange
      let resolve: (list: PositionList) => void = () => undefined;
      client.onGetExperience = () => new Promise<PositionList>((r) => (resolve = r));
      client.onGetSkills = () => Promise.resolve(createSkillList('C#'));
      fixture = TestBed.createComponent(ExperienceTimeline);
      host = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();

      // Act
      fixture.destroy();
      resolve(createPositionList());
      await new Promise((r) => setTimeout(r, 0));

      // Assert
      expect(client.skillsCalls).toBe(0);
    });
  });

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(ExperienceTimeline);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function filter(): HTMLElement {
    return host.querySelector<HTMLElement>('#skill-filter') as HTMLElement;
  }

  function chips(): HTMLButtonElement[] {
    return Array.from(host.querySelectorAll<HTMLButtonElement>('.skill-chip'));
  }

  function chipLabels(): string[] {
    return chips().map((chip) => chip.textContent ?? '');
  }

  function arrangeApiAnswers(positions: PositionList, skills: SkillList): void {
    client.onGetExperience = () => Promise.resolve(positions);
    client.onGetSkills = () => Promise.resolve(skills);
    client.onGetSeed = () => Promise.resolve([createPosition()]);
  }

  function arrangeApiFails(error: Error): void {
    client.onGetExperience = () => Promise.reject(error);
    client.onGetSeed = () => Promise.resolve([createPosition()]);
  }
});
