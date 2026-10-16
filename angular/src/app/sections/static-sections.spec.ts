import { TestBed } from '@angular/core/testing';
import { AboutSection } from './about-section/about-section';
import { ColophonSection } from './colophon-section/colophon-section';
import { HeroSection } from './hero-section/hero-section';
import { PortfolioSection } from './portfolio-section/portfolio-section';
import { QuoteSection } from './quote-section/quote-section';
import { ResumeSection } from './resume-section/resume-section';
import { createSiteTestServices } from '../../testing/site-testing';

describe('static sections', () => {
  describe('HeroSection', () => {
    it('should render the name, the three highlights with the edition links, and both calls to action', async () => {
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
      const highlights = Array.from(host.querySelectorAll<HTMLAnchorElement>('.highlight-value a')).map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('title')]);
      expect(highlights).toEqual([
        ['Angular', 'https://angular.mvcprogrammer.com/', 'See the Angular edition of this site'],
        ['React', 'https://react.mvcprogrammer.com/', 'See the React edition of this site'],
      ]);
      expect(host.querySelectorAll('.highlight-value')[0].textContent).toBe('C# / .NET');
      expect(host.querySelectorAll('.highlight-value')[1].textContent).toBe('Angular / React');
    });
  });

  describe('AboutSection', () => {
    it('should link the Angular, React, Blazor, and JavaScript tags to the four editions with a hint', async () => {
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
    it('should link only to the source and open the kiosk from the card button', async () => {
      // Arrange
      const services = createSiteTestServices();
      await TestBed.configureTestingModule({ imports: [PortfolioSection], providers: services.providers }).compileComponents();
      const fixture = TestBed.createComponent(PortfolioSection);
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      const dialog = host.querySelector('dialog') as HTMLDialogElement;
      Object.defineProperty(dialog, 'showModal', { value: vi.fn(), configurable: true });
      expect(host.querySelector('iframe')).toBeNull();

      // Act
      host.querySelector<HTMLButtonElement>('.card-actions button')?.click();
      await fixture.whenStable();

      // Assert
      expect(host.querySelector('iframe')?.getAttribute('src')).toBe('https://kiosk.example.test/');
      const links = Array.from(host.querySelectorAll('.portfolio-card-featured .card-link')).map((a) => a.getAttribute('href'));
      expect(links).toEqual(['https://github.com/mvcprogrammer/mvcprogrammer.com']);
      expect(host.querySelectorAll('.portfolio-card').length).toBe(3);
    });
  });

  describe('ResumeSection', () => {
    it('should use the configured resume URL and render the timeline and education', async () => {
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
      expect(host.querySelectorAll('.timeline-compact .timeline-item').length).toBe(2);
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
      expect(host.querySelectorAll('.colophon-item').length).toBe(9);
    });
  });
});
