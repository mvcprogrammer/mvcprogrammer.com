import { fireEvent, render, screen } from '@testing-library/react';
import { createSiteTestServices, renderWithSite } from '../../testing/site-testing';
import { AboutSection } from './AboutSection';
import { ColophonSection } from './ColophonSection';
import { HeroSection } from './HeroSection';
import { FHIR_HASH, PortfolioSection } from './PortfolioSection';
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
    it('should link the edition tags to the four editions and the Healthcare tag to the FHIR API card, each with a hint', () => {
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
        [
          'Healthcare (HL7, FHIR, HIPAA)',
          '#fhir-api',
          'Open the FHIR API card and its live patient explorer in Selected Work',
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
    it('should link only to the source and open the kiosk from the card button', () => {
      // Arrange
      const services = createSiteTestServices();
      renderWithSite(<PortfolioSection />, services);
      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      Object.defineProperty(dialog, 'showModal', { value: vi.fn(), configurable: true });
      expect(document.querySelector('iframe')).toBeNull();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Try the live kiosk' }));

      // Assert
      expect(document.querySelector('iframe')?.getAttribute('src')).toBe(
        'https://kiosk.example.test/',
      );
      const links = Array.from(
        document.querySelectorAll('.portfolio-card-featured .card-link'),
      ).map((a) => a.getAttribute('href'));
      expect(links).toEqual(['https://github.com/mvcprogrammer/mvcprogrammer.com']);
      expect(document.querySelectorAll('.portfolio-card').length).toBe(4);
      expect(document.querySelector('.portfolio-card-featured .card-subtitle')?.textContent).toBe(
        'The tech behind this site, in four editions',
      );
    });

    it('should render the FHIR API card last, closed, without the explorer or any FHIR request', () => {
      // Arrange
      const services = createSiteTestServices();
      window.location.hash = '';

      // Act
      renderWithSite(<PortfolioSection />, services);

      // Assert
      const cards = document.querySelectorAll('.portfolio-card');
      const card = cards[cards.length - 1]!;
      expect(card.id).toBe('fhir-api');
      expect(card.querySelector('h3')?.textContent).toBe('FHIR API');
      expect(card.querySelector('.card-media img')?.getAttribute('src')).toBe('assets/images/portfolio/fhir-api-react.jpg');
      const links = Array.from(card.querySelectorAll(':scope > .card-body > .card-link')).map((a) => a.getAttribute('href'));
      expect(links).toEqual([
        'https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/api/src/Fhir.Api',
        'https://github.com/mvcprogrammer/mvcprogrammer.com/blob/main/api/openapi.yaml',
      ]);
      expect(accordion().open).toBe(false);
      expect(accordion().querySelector('summary')?.classList.contains('button-primary')).toBe(true);
      expect(document.getElementById('fhir-search')).toBeNull();
      expect(services.fhir.capabilityCalls).toBe(0);
    });

    it('should load the explorer, which checks the capability, when the accordion is opened, and keep it when closed again', async () => {
      // Arrange
      const services = createSiteTestServices();
      window.location.hash = '';
      renderWithSite(<PortfolioSection />, services);

      // Act
      toggle(true);
      await screen.findByText(/every resource and search parameter/);

      // Assert
      expect(document.getElementById('fhir-search')).not.toBeNull();
      expect(services.fhir.capabilityCalls).toBe(1);

      // Act again
      toggle(false);

      // Assert again
      expect(accordion().open).toBe(false);
      expect(document.getElementById('fhir-search')).not.toBeNull();
      expect(services.fhir.capabilityCalls).toBe(1);
    });

    it('should open the accordion when the URL fragment changes to #fhir-api', async () => {
      // Arrange
      const services = createSiteTestServices();
      window.location.hash = '';
      renderWithSite(<PortfolioSection />, services);

      // Act
      window.location.hash = FHIR_HASH;
      fireEvent(window, new Event('hashchange'));
      await screen.findByText(/every resource and search parameter/);

      // Assert
      expect(accordion().open).toBe(true);
      window.location.hash = '';
    });

    it('should open the accordion on first render when the page loads on #fhir-api', async () => {
      // Arrange
      window.location.hash = FHIR_HASH;

      // Act
      renderWithSite(<PortfolioSection />);
      await screen.findByText(/every resource and search parameter/);

      // Assert
      expect(accordion().open).toBe(true);
      window.location.hash = '';
    });

    it('should remove the iframe once the dialog closes', () => {
      // Arrange
      renderWithSite(<PortfolioSection />);
      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      Object.defineProperty(dialog, 'showModal', { value: vi.fn(), configurable: true });
      fireEvent.click(screen.getByRole('button', { name: 'Try the live kiosk' }));
      expect(document.querySelector('iframe')).not.toBeNull();

      // Act
      fireEvent(dialog, new Event('close'));

      // Assert
      expect(document.querySelector('iframe')).toBeNull();
    });

    function accordion(): HTMLDetailsElement {
      return document.querySelector('details.fhir-accordion') as HTMLDetailsElement;
    }

    /** Flips the native element the way a click on the summary does, then fires its toggle event. */
    function toggle(open: boolean): void {
      accordion().open = open;
      fireEvent(accordion(), new Event('toggle'));
    }
  });

  describe('ResumeSection', () => {
    it('should use the configured resume URL and render the timeline and education', async () => {
      // Arrange, Act
      renderWithSite(<ResumeSection />);

      // Assert
      expect(document.querySelector('a.button-secondary')?.getAttribute('href')).toBe(
        'https://resume.example.test/',
      );
      expect(document.querySelector('#experience-timeline')).not.toBeNull();
      expect(document.querySelectorAll('.timeline-compact .timeline-item').length).toBe(2);
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
