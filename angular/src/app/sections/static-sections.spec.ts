import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AboutSection } from './about-section/about-section';
import { ColophonSection } from './colophon-section/colophon-section';
import { HeroSection } from './hero-section/hero-section';
import { PortfolioSection } from './portfolio-section/portfolio-section';
import { QuoteSection } from './quote-section/quote-section';
import { ResumeSection } from './resume-section/resume-section';
import { createSiteTestServices } from '../../testing/site-testing';

describe('static sections', () => {
  describe('HeroSection', () => {
    it('should render the name, the three plain highlights, and both calls to action', async () => {
      // Arrange
      const fixture = TestBed.createComponent(HeroSection);

      // Act
      await fixture.whenStable();

      // Assert
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('h1')?.textContent).toContain('Neal');
      expect(host.querySelectorAll('.highlights li').length).toBe(3);
      const hrefs = Array.from(host.querySelectorAll('.button-row a')).map((a) => a.getAttribute('href'));
      expect(hrefs).toEqual(['#portfolio', '#contact']);
      // No highlight links to the editions (removed 2026-10-19): the edition menu and the About chips carry those
      expect(host.querySelectorAll('.highlight-value a').length).toBe(0);
      expect(host.querySelectorAll('.highlight-value')[0].textContent).toBe('C# / .NET');
      expect(host.querySelectorAll('.highlight-value')[1].textContent).toBe('Angular / React');
    });
  });

  describe('AboutSection', () => {
    it('should link only the four edition tags, each with a hint; the Domains chips are plain text', async () => {
      // Arrange
      const fixture = TestBed.createComponent(AboutSection);

      // Act
      await fixture.whenStable();

      // Assert
      const host = fixture.nativeElement as HTMLElement;
      const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.tag a')).map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('title')]);
      expect(links).toEqual([
        ['Angular', 'https://angular.mvcprogrammer.com/', 'See the Angular edition of this site'],
        ['React', 'https://react.mvcprogrammer.com/', 'See the React edition of this site'],
        ['Blazor', 'https://blazor.mvcprogrammer.com/', 'See the Blazor edition of this site'],
        ['JavaScript', 'https://mvcprogrammer.com/', 'See the plain JavaScript edition of this site'],
        ['Healthcare (HL7, FHIR, HIPAA)', 'https://fhir.mvcprogrammer.com/', 'See the live FHIR R4 patient explorer'],
      ]);
      const tags = Array.from(host.querySelectorAll('ul[aria-label="Skills"] .tag')).map((tag) => tag.textContent?.trim());
      expect(tags.length).toBe(12);
      expect(tags).toContain('Claude Pair Programming');
      expect(tags).not.toContain('RabbitMQ');
    });
  });

  describe('QuoteSection', () => {
    it('should attribute the quote', async () => {
      // Arrange
      const fixture = TestBed.createComponent(QuoteSection);

      // Act
      await fixture.whenStable();

      // Assert
      expect((fixture.nativeElement as HTMLElement).querySelector('figcaption')?.textContent).toBe('Alan Turing');
    });
  });

  describe('PortfolioSection', () => {
    let fixture: ComponentFixture<PortfolioSection>;
    let host: HTMLElement;

    beforeEach(async () => {
      const services = createSiteTestServices();
      await TestBed.configureTestingModule({ imports: [PortfolioSection], providers: services.providers }).compileComponents();
      fixture = TestBed.createComponent(PortfolioSection);
      await fixture.whenStable();
      host = fixture.nativeElement as HTMLElement;
      // jsdom has no modal dialogs; the stub keeps the open state honest for both dialogs
      for (const dialog of Array.from(host.querySelectorAll('dialog'))) {
        Object.defineProperty(dialog, 'showModal', { value: vi.fn(() => dialog.setAttribute('open', '')), configurable: true });
        Object.defineProperty(dialog, 'open', { get: () => dialog.hasAttribute('open'), configurable: true });
      }
    });

    it('should give each project card one primary button with a single row of links after it', () => {
      // Assert
      const cards = Array.from(host.querySelectorAll('.portfolio-card:not(.portfolio-card-featured)'));
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

    it('should link only to the source and open the kiosk from the card button', async () => {
      // Arrange
      expect(host.querySelector('iframe')).toBeNull();

      // Act
      host.querySelector<HTMLButtonElement>('.portfolio-card:last-of-type .card-actions button')?.click();
      await fixture.whenStable();

      // Assert
      expect(host.querySelector('#kiosk-dialog iframe')?.getAttribute('src')).toBe('https://kiosk.example.test/');
      expect(host.querySelector('#fhir-dialog iframe')).toBeNull();
      const links = Array.from(host.querySelectorAll('.portfolio-card-featured .card-link')).map((a) => a.getAttribute('href'));
      expect(links).toEqual(['https://github.com/mvcprogrammer/mvcprogrammer.com']);
      expect(host.querySelectorAll('.portfolio-card').length).toBe(4);
    });

    it('should render the FHIR API card first after the featured card as a pitch with no explorer in the page', () => {
      // Assert
      const card = host.querySelectorAll('.portfolio-card')[1];
      expect(card.id).toBe('fhir-api');
      expect(card.querySelector('h3')?.textContent).toBe('FHIR API');
      expect(card.querySelector('.card-subtitle')?.textContent).toBe('FHIR R4 patient explorer, Angular in front of C# on Lambda with the Firely SDK');
      expect(card.querySelector('.card-media img')?.getAttribute('src')).toBe('assets/images/portfolio/fhir-explorer.jpg');
      expect(card.querySelector('.card-actions button')?.textContent?.trim()).toBe('Try the patient explorer');
      expect(card.querySelector('.card-actions button use')?.getAttribute('href')).toBe('#icon-data');
      const links = Array.from(card.querySelectorAll(':scope > .card-body > .card-links > .card-link')).map((a) => a.getAttribute('href'));
      expect(links).toEqual([
        'https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/api/src/Fhir.Api',
        'https://github.com/mvcprogrammer/mvcprogrammer.com/blob/main/api/openapi.yaml',
        'https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/fhir',
      ]);
      expect(card.querySelector('details')).toBeNull();
      expect(host.querySelector('.fhir-explorer')).toBeNull();
      expect(host.querySelector('iframe')).toBeNull();
    });

    it('should open the patient explorer in the tall demo dialog from the FHIR card button', async () => {
      // Arrange
      const dialog = host.querySelector('#fhir-dialog') as HTMLDialogElement;
      expect(dialog.getAttribute('data-frame')).toBe('tall');
      expect(dialog.getAttribute('aria-labelledby')).toBe('fhir-dialog-title');
      expect(dialog.querySelector('#fhir-dialog-title')?.textContent).toBe('FHIR R4 Patient Explorer');

      // Act
      host.querySelector<HTMLButtonElement>('#fhir-api .card-actions button')?.click();
      await fixture.whenStable();

      // Assert
      expect(dialog.querySelector('iframe')?.getAttribute('src')).toBe('https://fhir.example.test/');
      expect(dialog.querySelector('iframe')?.getAttribute('title')).toBe('FHIR R4 Patient Explorer, live');
      expect(dialog.querySelector('.demo-dialog-foot a')?.getAttribute('href')).toBe('https://fhir.example.test/');
      expect(host.querySelector('#kiosk-dialog iframe')).toBeNull();
    });
  });

  describe('ResumeSection', () => {
    it('should use the configured resume URL and render the timeline, education, and continuing education', async () => {
      // Arrange
      const services = createSiteTestServices();
      await TestBed.configureTestingModule({ imports: [ResumeSection], providers: services.providers }).compileComponents();
      const fixture = TestBed.createComponent(ResumeSection);

      // Act
      await fixture.whenStable();

      // Assert
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('a.button-secondary')?.getAttribute('href')).toBe('https://resume.example.test/');
      expect(host.querySelector('#experience-timeline')).not.toBeNull();
      const subsections = Array.from(host.querySelectorAll('.subsection-title')).map((h) => h.textContent?.trim());
      expect(subsections).toEqual(['Education', 'Continuing Education']);
      expect(host.querySelectorAll('.timeline-compact .timeline-item').length).toBe(2);
      expect(host.querySelectorAll('.timeline-compact')[1]?.textContent).toContain('MIT OpenCourseWare');
    });
  });

  describe('ColophonSection', () => {
    it('should describe the Angular edition and link to its source', async () => {
      // Arrange
      const fixture = TestBed.createComponent(ColophonSection);

      // Act
      await fixture.whenStable();

      // Assert
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('a.card-link')?.getAttribute('href')).toBe('https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/angular');
      expect(host.querySelector('.section-intro')?.textContent).toContain('Angular edition');
      expect(host.querySelectorAll('.colophon-item').length).toBe(10);
    });
  });
});
