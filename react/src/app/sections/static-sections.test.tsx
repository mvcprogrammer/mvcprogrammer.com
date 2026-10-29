import { fireEvent, render, screen } from '@testing-library/react';
import { TEST_SITE_OPTIONS, createSiteTestServices, renderWithSite } from '../../testing/site-testing';
import { AboutSection } from './AboutSection';
import { ColophonSection } from './ColophonSection';
import { HeroSection } from './HeroSection';
import { PortfolioSection } from './PortfolioSection';
import { QuoteSection } from './QuoteSection';
import { ResumeSection } from './ResumeSection';

describe('static sections', () => {
  describe('HeroSection', () => {
    it('should render the name, the three plain highlights, and both calls to action', () => {
      // Arrange, Act
      const { container } = render(<HeroSection />);

      // Assert
      expect(container.querySelector('h1')?.textContent).toContain('Neal');
      expect(container.querySelectorAll('.highlights li').length).toBe(3);
      const hrefs = Array.from(container.querySelectorAll('.button-row a')).map((a) =>
        a.getAttribute('href'),
      );
      expect(hrefs).toEqual(['#portfolio', '#contact']);
      // No highlight links to the editions (removed 2026-10-19): the edition menu and the About chips carry those
      expect(container.querySelectorAll('.highlight-value a').length).toBe(0);
      expect(container.querySelectorAll('.highlight-value')[0]?.textContent).toBe('C# / .NET');
      expect(container.querySelectorAll('.highlight-value')[1]?.textContent).toBe(
        'Angular / React',
      );
    });
  });

  describe('AboutSection', () => {
    it('should link only the four edition tags, each with a hint; the Domains chips are plain text', () => {
      // Arrange, Act
      const { container } = render(<AboutSection />);

      // Assert
      const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('.tag a')).map((a) => [
        a.textContent,
        a.getAttribute('href'),
        a.getAttribute('title'),
      ]);
      expect(links).toEqual([
        ['Angular', 'https://angular.mvcprogrammer.com/', 'See the Angular edition of this site'],
        ['React', 'https://react.mvcprogrammer.com/', 'See the React edition of this site'],
        ['Blazor', 'https://blazor.mvcprogrammer.com/', 'See the Blazor edition of this site'],
        [
          'JavaScript',
          'https://mvcprogrammer.com/',
          'See the plain JavaScript edition of this site',
        ],
      ]);
      const tags = Array.from(container.querySelectorAll('ul[aria-label="Skills"] .tag')).map(
        (tag) => tag.textContent?.trim(),
      );
      expect(tags.length).toBe(12);
      expect(tags).toContain('Claude Pair Programming');
      expect(tags).not.toContain('RabbitMQ');
    });
  });

  describe('QuoteSection', () => {
    it('should attribute the quote', () => {
      // Arrange, Act
      const { container } = render(<QuoteSection />);

      // Assert
      expect(container.querySelector('figcaption')?.textContent).toBe('Alan Turing');
    });
  });

  describe('PortfolioSection', () => {
    it('should give each project card one primary button with a single row of links after it', () => {
      // Arrange, Act
      renderWithSite(<PortfolioSection />, createSiteTestServices());

      // Assert
      const cards = Array.from(document.querySelectorAll('.portfolio-card:not(.portfolio-card-featured)'));
      const actions = cards.map((card) => {
        const buttons = card.querySelectorAll('.card-actions .button-primary');
        const rows = card.querySelectorAll(':scope > .card-body > .card-links');
        const button = buttons[0];
        const row = rows[0];
        return {
          buttons: buttons.length,
          rows: rows.length,
          // DOCUMENT_POSITION_FOLLOWING: the link row comes after the button
          rowAfterButton: button !== undefined && row !== undefined && (button.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          links: Array.from(row?.querySelectorAll('.card-link') ?? []).map((a) => a.textContent?.trim()),
        };
      });
      expect(actions).toEqual([
        { buttons: 1, rows: 1, rowAfterButton: true, links: ['API repo', 'OpenAPI spec', 'Explorer repo'] },
        { buttons: 1, rows: 1, rowAfterButton: true, links: ['Site repo'] },
        { buttons: 1, rows: 1, rowAfterButton: true, links: ['Screen repo', 'API repo'] },
      ]);
      const visit = cards[1].querySelector<HTMLAnchorElement>('.card-actions a.button-primary');
      expect(visit?.getAttribute('href')).toBe('https://lightsplitters.com');
      expect(visit?.textContent?.trim()).toBe('Visit lightsplitters.com');
      expect(visit?.querySelector('use')?.getAttribute('href')).toBe('#icon-globe');
    });

    it('should link only to the source and open the kiosk from the card button', () => {
      // Arrange
      const services = createSiteTestServices();
      renderWithSite(<PortfolioSection />, services);
      stubShowModal('kiosk-dialog');
      expect(document.querySelector('iframe')).toBeNull();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Try the live kiosk' }));

      // Assert
      expect(document.querySelector('#kiosk-dialog iframe')?.getAttribute('src')).toBe(
        'https://kiosk.example.test/',
      );
      expect(document.querySelector('#fhir-dialog iframe')).toBeNull();
      const links = Array.from(
        document.querySelectorAll('.portfolio-card-featured .card-link'),
      ).map((a) => a.getAttribute('href'));
      expect(links).toEqual(['https://github.com/mvcprogrammer/mvcprogrammer.com']);
      expect(document.querySelectorAll('.portfolio-card').length).toBe(4);
      expect(document.querySelector('.portfolio-card-featured .card-subtitle')?.textContent).toBe(
        'The tech behind this site, in four editions',
      );
    });

    it('should render the FHIR API card first after the featured card as a pitch with the explorer button', () => {
      // Arrange, Act
      renderWithSite(<PortfolioSection />, createSiteTestServices());

      // Assert
      const card = document.querySelectorAll('.portfolio-card')[1]!;
      expect(card.id).toBe('fhir-api');
      expect(card.querySelector('h3')?.textContent).toBe('FHIR API');
      expect(card.querySelector('.card-subtitle')?.textContent?.trim()).toBe(
        'FHIR R4 patient explorer, Angular in front of C# on Lambda with the Firely SDK',
      );
      expect(card.querySelector('.card-media img')?.getAttribute('src')).toBe('assets/images/portfolio/fhir-explorer.jpg');
      const links = Array.from(card.querySelectorAll(':scope > .card-body > .card-links > .card-link')).map((a) => a.getAttribute('href'));
      expect(links).toEqual([
        'https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/api/src/Fhir.Api',
        'https://github.com/mvcprogrammer/mvcprogrammer.com/blob/main/api/openapi.yaml',
        'https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/fhir',
      ]);
      const tags = Array.from(card.querySelectorAll('.card-tags .tag')).map((tag) => tag.textContent);
      expect(tags[tags.length - 1]).toBe('Angular 22');
      const button = card.querySelector('.card-actions button.button-primary');
      expect(button?.textContent?.trim()).toBe('Try the patient explorer');
      expect(button?.querySelector('use')?.getAttribute('href')).toBe('#icon-data');
      expect(card.querySelector('details')).toBeNull();
      expect(document.querySelector('iframe')).toBeNull();
    });

    it('should open the explorer in the tall FHIR dialog from the card button', () => {
      // Arrange
      renderWithSite(<PortfolioSection />, createSiteTestServices());
      const showModal = stubShowModal('fhir-dialog');

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Try the patient explorer' }));

      // Assert
      expect(showModal).toHaveBeenCalledTimes(1);
      const dialog = document.getElementById('fhir-dialog');
      expect(dialog?.getAttribute('data-frame')).toBe('tall');
      expect(dialog?.querySelector('h2')?.textContent).toBe('FHIR R4 Patient Explorer');
      expect(dialog?.querySelector('iframe')?.getAttribute('src')).toBe(TEST_SITE_OPTIONS.fhirExplorerUrl);
      expect(document.querySelector('#kiosk-dialog iframe')).toBeNull();
    });

    it('should remove the iframe once a dialog closes', () => {
      // Arrange
      renderWithSite(<PortfolioSection />);
      stubShowModal('kiosk-dialog');
      fireEvent.click(screen.getByRole('button', { name: 'Try the live kiosk' }));
      expect(document.querySelector('iframe')).not.toBeNull();

      // Act
      fireEvent(document.getElementById('kiosk-dialog')!, new Event('close'));

      // Assert
      expect(document.querySelector('iframe')).toBeNull();
    });

    /** jsdom has no modal dialogs; the stubs record the calls and track the open attribute the way a browser does. */
    function stubShowModal(id: string): ReturnType<typeof vi.fn> {
      const dialog = document.getElementById(id) as HTMLDialogElement;
      const showModal = vi.fn(() => dialog.setAttribute('open', ''));
      Object.defineProperty(dialog, 'showModal', { value: showModal, configurable: true });
      Object.defineProperty(dialog, 'close', { value: () => dialog.removeAttribute('open'), configurable: true });
      return showModal;
    }
  });

  describe('ResumeSection', () => {
    it('should use the configured resume URL and render the timeline, education, and continuing education', async () => {
      // Arrange, Act
      renderWithSite(<ResumeSection />);

      // Assert
      expect(document.querySelector('a.button-secondary')?.getAttribute('href')).toBe(
        'https://resume.example.test/',
      );
      expect(document.querySelector('#experience-timeline')).not.toBeNull();
      const subsections = Array.from(document.querySelectorAll('.subsection-title')).map((h) => h.textContent?.trim());
      expect(subsections).toEqual(['Education', 'Continuing Education']);
      expect(document.querySelectorAll('.timeline-compact .timeline-item').length).toBe(2);
      expect(document.querySelectorAll('.timeline-compact')[1]?.textContent).toContain('MIT OpenCourseWare');
      await screen.findByRole('status');
    });
  });

  describe('ColophonSection', () => {
    it('should describe the React edition and link to its source', () => {
      // Arrange, Act
      const { container } = render(<ColophonSection />);

      // Assert
      expect(container.querySelector('a.card-link')?.getAttribute('href')).toBe(
        'https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/react',
      );
      expect(container.querySelector('.section-intro')?.textContent).toContain('React edition');
      expect(container.querySelectorAll('.colophon-item').length).toBe(10);
    });
  });
});
