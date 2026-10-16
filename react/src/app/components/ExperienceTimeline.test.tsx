import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { PositionList } from '../models/position-list';
import {
  createSiteTestServices,
  renderWithSite,
  textOf,
  type SiteTestServices,
} from '../../testing/site-testing';
import { createPosition, createPositionList, createSkillList } from '../../testing/test-data';
import {
  DEMOTED_SKILLS,
  ExperienceTimeline,
  orderChips,
  PINNED_SKILLS,
  positionsLabel,
  VISIBLE_CHIPS,
} from './ExperienceTimeline';

describe('ExperienceTimeline', () => {
  describe('loading', () => {
    it('should render the positions from the API with month and place labels', async () => {
      // Arrange
      const services = arrangeApi(createPositionList(), createSkillList('C#'));

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      await screen.findByText('Senior Software Engineer');

      // Assert
      const items = document.querySelectorAll('.timeline-item');
      expect(items.length).toBe(2);
      expect(textOf(items[0]!.querySelector('.timeline-date'))).toBe(
        'Dec 2023 – May 2026 · Remote',
      );
      expect(textOf(items[1]!.querySelector('.timeline-date'))).toBe(
        'Feb 2020 – Aug 2022 · Florida',
      );
      expect(items[0]!.querySelector('time')?.getAttribute('dateTime')).toBe('2023-12');
      expect(textOf(items[0]!.querySelector('.timeline-points'))).toBe('Did the work.');
      expect(services.experience.seedCalls).toBe(0);
    });

    it('should show Present for a current position', async () => {
      // Arrange
      const list = { count: 1, items: [createPosition({ endDate: null })] };
      const services = arrangeApi(list, createSkillList('C#'));

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      await screen.findByText('Senior Software Engineer');

      // Assert
      expect(textOf(document.querySelector('.timeline-date'))).toBe('Dec 2023 – Present · Remote');
    });

    it('should reveal the skill filter with the chips once the skills load', async () => {
      // Arrange
      const services = arrangeApi(createPositionList(), createSkillList('C#', 'React'));

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      await screen.findByRole('button', { name: 'React' });

      // Assert
      const filter = document.getElementById('skill-filter') as HTMLElement;
      expect(filter.hidden).toBe(false);
      const chips = Array.from(document.querySelectorAll('.skill-chip')).map(
        (chip) => chip.textContent,
      );
      expect(chips).toEqual(['All', 'C#', 'React']);
      expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
      expect(textOf(document.querySelector('.skill-filter-status'))).toBe(
        '2 positions · live from /api/experience',
      );
      expect(document.querySelector('.skill-filter-link')?.getAttribute('href')).toBe(
        '/api/experience',
      );
    });

    it('should fall back to the seed when the API fails', async () => {
      // Arrange
      const services = createSiteTestServices();
      services.experience.onGetExperience = () => Promise.reject(new Error('down'));
      services.experience.onGetSeed = () => Promise.resolve(createPositionList().items);

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      await screen.findByText('Senior Software Engineer');

      // Assert
      expect(services.experience.seedCalls).toBe(1);
      expect(services.experience.skillsCalls).toBe(0);
      expect((document.getElementById('skill-filter') as HTMLElement).hidden).toBe(true);
      expect(document.querySelector('.form-status')).toBeNull();
    });

    it('should fall back to the seed when the API returns no positions', async () => {
      // Arrange
      const services = createSiteTestServices();
      services.experience.onGetExperience = () => Promise.resolve({ count: 0, items: [] });
      services.experience.onGetSeed = () => Promise.resolve([createPosition()]);

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      await screen.findByText('Senior Software Engineer');

      // Assert
      expect(services.experience.seedCalls).toBe(1);
    });

    it('should fall back to the seed when the API body is not a list', async () => {
      // Arrange
      const services = createSiteTestServices();
      services.experience.onGetExperience = () => Promise.resolve({ count: 0 } as PositionList);
      services.experience.onGetSeed = () => Promise.resolve([createPosition()]);

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      await screen.findByText('Senior Software Engineer');

      // Assert
      expect(services.experience.seedCalls).toBe(1);
    });

    it('should show the failure message with the resume link when the seed fails too', async () => {
      // Arrange
      const services = createSiteTestServices();
      services.experience.onGetExperience = () => Promise.reject(new Error('down'));
      services.experience.onGetSeed = () => Promise.reject(new Error('missing'));

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      const status = await screen.findByRole('status');

      // Assert
      expect(status.textContent).toContain('The work history could not be loaded right now.');
      expect(status.querySelector('a')?.getAttribute('href')).toBe('https://resume.example.test/');
      expect(document.querySelectorAll('.timeline-item').length).toBe(0);
    });

    it('should show the failure message when the seed is empty', async () => {
      // Arrange
      const services = createSiteTestServices();
      services.experience.onGetExperience = () => Promise.reject(new Error('down'));
      services.experience.onGetSeed = () => Promise.resolve([]);

      // Act
      renderWithSite(<ExperienceTimeline />, services);

      // Assert
      await screen.findByRole('status');
    });

    it('should keep the positions and hide the filter when only the skills fail', async () => {
      // Arrange
      const services = arrangeApi(createPositionList(), createSkillList());
      services.experience.onGetSkills = () => Promise.reject(new Error('down'));

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      await screen.findByText('Senior Software Engineer');
      await waitFor(() => expect(services.experience.skillsCalls).toBe(1));

      // Assert
      expect((document.getElementById('skill-filter') as HTMLElement).hidden).toBe(true);
      expect(services.experience.seedCalls).toBe(0);
      expect(document.querySelector('.form-status')).toBeNull();
    });

    it('should keep the filter hidden when the API returns no skills', async () => {
      // Arrange
      const services = arrangeApi(createPositionList(), createSkillList());

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      await screen.findByText('Senior Software Engineer');
      await waitFor(() => expect(services.experience.skillsCalls).toBe(1));

      // Assert
      expect((document.getElementById('skill-filter') as HTMLElement).hidden).toBe(true);
    });

    it('should drop a response that arrives after unmount', async () => {
      // Arrange
      const services = createSiteTestServices();
      let resolve: (list: PositionList) => void = () => undefined;
      services.experience.onGetExperience = () => new Promise<PositionList>((r) => (resolve = r));
      const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { unmount } = renderWithSite(<ExperienceTimeline />, services);

      // Act
      unmount();
      resolve(createPositionList());
      await Promise.resolve();
      await Promise.resolve();

      // Assert
      expect(services.experience.skillsCalls).toBe(0);
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });
  });

  describe('chips', () => {
    it('should order the chips pinned first, then the rest, then the demoted ones', () => {
      // Arrange
      const skills = createSkillList(
        'CloudWatch',
        'SQL Server',
        'React',
        'Docker',
        'C#',
        'ASP.NET Web API',
      ).items;

      // Act
      const ordered = orderChips(skills).map((skill) => skill.name);

      // Assert
      expect(ordered).toEqual([
        'ASP.NET Web API',
        'C#',
        'React',
        'SQL Server',
        'Docker',
        'CloudWatch',
      ]);
      expect(PINNED_SKILLS).toContain('Claude Pair Programming');
      expect(DEMOTED_SKILLS).toEqual(['CloudWatch']);
    });

    it('should hide the chips past the visible count behind a more button that reveals them', async () => {
      // Arrange
      const names = Array.from({ length: VISIBLE_CHIPS + 3 }, (_, i) => `Skill ${i + 1}`);
      const services = arrangeApi(createPositionList(), createSkillList(...names));
      renderWithSite(<ExperienceTimeline />, services);
      const more = await screen.findByRole('button', { name: '+3 more' });
      const hiddenBefore = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.skill-chip'),
      ).filter((chip) => chip.hidden);
      expect(hiddenBefore.map((chip) => chip.textContent)).toEqual([
        'Skill 13',
        'Skill 14',
        'Skill 15',
      ]);

      // Act
      fireEvent.click(more);

      // Assert
      expect(screen.queryByRole('button', { name: '+3 more' })).toBeNull();
      expect(
        Array.from(document.querySelectorAll<HTMLButtonElement>('.skill-chip')).filter(
          (chip) => chip.hidden,
        ).length,
      ).toBe(0);
    });

    it('should show no more button when every chip fits', async () => {
      // Arrange
      const services = arrangeApi(createPositionList(), createSkillList('C#', 'React'));

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      await screen.findByRole('button', { name: 'React' });

      // Assert
      expect(document.querySelector('.skill-chip-more')).toBeNull();
    });

    it('should title each chip with its position count', async () => {
      // Arrange
      const skills = createSkillList('C#', 'React');
      const services = arrangeApi(createPositionList(), {
        count: 2,
        items: [{ ...skills.items[0]!, positionCount: 3 }, skills.items[1]!],
      });

      // Act
      renderWithSite(<ExperienceTimeline />, services);
      await screen.findByRole('button', { name: 'React' });

      // Assert
      expect(screen.getByRole('button', { name: 'C#' }).getAttribute('title')).toBe('3 positions');
      expect(screen.getByRole('button', { name: 'React' }).getAttribute('title')).toBe(
        '1 position',
      );
      expect(positionsLabel(0)).toBe('0 positions');
    });
  });

  describe('filtering', () => {
    it('should fetch the positions for a chip and show the count, the path, and the pressed state', async () => {
      // Arrange
      const services = arrangeApi(createPositionList(), createSkillList('C#', 'React'));
      services.experience.onGetExperience = (skill) =>
        Promise.resolve(
          skill === null
            ? createPositionList()
            : { count: 1, items: [createPosition({ id: 'react-job', title: 'React Engineer' })] },
        );
      renderWithSite(<ExperienceTimeline />, services);
      const chip = await screen.findByRole('button', { name: 'React' });

      // Act
      fireEvent.click(chip);
      await screen.findByText('React Engineer');

      // Assert
      expect(services.experience.experienceCalls).toEqual([null, 'React']);
      expect(document.querySelectorAll('.timeline-item').length).toBe(1);
      expect(textOf(document.querySelector('.skill-filter-count'))).toBe('1 position with React');
      expect(document.querySelector('.skill-filter-link')?.getAttribute('href')).toBe(
        '/api/experience?skill=React',
      );
      expect(chip.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe(
        'false',
      );
      expect(document.getElementById('experience-timeline')?.classList.contains('is-loading')).toBe(
        false,
      );
    });

    it('should restore every position for All without another request', async () => {
      // Arrange
      const services = arrangeApi(createPositionList(), createSkillList('C#'));
      services.experience.onGetExperience = (skill) =>
        Promise.resolve(
          skill === null
            ? createPositionList()
            : { count: 1, items: [createPosition({ id: 'only' })] },
        );
      renderWithSite(<ExperienceTimeline />, services);
      fireEvent.click(await screen.findByRole('button', { name: 'C#' }));
      await waitFor(() => expect(document.querySelectorAll('.timeline-item').length).toBe(1));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'All' }));
      await waitFor(() => expect(document.querySelectorAll('.timeline-item').length).toBe(2));

      // Assert
      expect(services.experience.experienceCalls).toEqual([null, 'C#']);
      expect(textOf(document.querySelector('.skill-filter-count'))).toBe('2 positions');
      expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('should restore every position and clear the selection when a filter request fails', async () => {
      // Arrange
      const services = arrangeApi(createPositionList(), createSkillList('C#'));
      services.experience.onGetExperience = (skill) =>
        skill === null ? Promise.resolve(createPositionList()) : Promise.reject(new Error('down'));
      renderWithSite(<ExperienceTimeline />, services);
      const chip = await screen.findByRole('button', { name: 'C#' });

      // Act
      fireEvent.click(chip);
      await waitFor(() => expect(services.experience.experienceCalls.length).toBe(2));

      // Assert
      await waitFor(() =>
        expect(
          document.getElementById('experience-timeline')?.classList.contains('is-loading'),
        ).toBe(false),
      );
      expect(document.querySelectorAll('.timeline-item').length).toBe(2);
      expect(chip.getAttribute('aria-pressed')).toBe('false');
      expect(textOf(document.querySelector('.skill-filter-count'))).toBe('2 positions');
    });

    it('should mark the timeline as loading while a filter request is in flight', async () => {
      // Arrange
      const services = arrangeApi(createPositionList(), createSkillList('C#'));
      let resolve: (list: PositionList) => void = () => undefined;
      services.experience.onGetExperience = (skill) =>
        skill === null
          ? Promise.resolve(createPositionList())
          : new Promise<PositionList>((r) => (resolve = r));
      renderWithSite(<ExperienceTimeline />, services);
      const chip = await screen.findByRole('button', { name: 'C#' });

      // Act
      fireEvent.click(chip);

      // Assert
      await waitFor(() =>
        expect(
          document.getElementById('experience-timeline')?.classList.contains('is-loading'),
        ).toBe(true),
      );
      resolve({ count: 1, items: [createPosition()] });
      await waitFor(() =>
        expect(
          document.getElementById('experience-timeline')?.classList.contains('is-loading'),
        ).toBe(false),
      );
    });
  });

  /** Services whose Experience API answers with the given lists. */
  function arrangeApi(
    positions: PositionList,
    skills: ReturnType<typeof createSkillList>,
  ): SiteTestServices {
    const services = createSiteTestServices();
    services.experience.onGetExperience = () => Promise.resolve(positions);
    services.experience.onGetSkills = () => Promise.resolve(skills);
    return services;
  }
});
