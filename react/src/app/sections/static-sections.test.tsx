import { fireEvent, render, screen } from '@testing-library/react';
import { createSiteTestServices, renderWithSite } from '../../testing/site-testing';
import { AboutSection } from './AboutSection';
import { ColophonSection } from './ColophonSection';
import { HeroSection } from './HeroSection';
import { PortfolioSection } from './PortfolioSection';
import { QuoteSection } from './QuoteSection';
import { ResumeSection } from './ResumeSection';

describe('static sections', () => {
  describe('HeroSection', () => {
    it('should render the name, the three highlights with the edition links, and both calls to action', () => {
      // Arrange, Act
      const { container } = render(<HeroSection />);

      // Assert
      expect(container.querySelector('h1')?.textContent).toContain('Neal');
      expect(container.querySelectorAll('.highlights li').length).toBe(3);
      const hrefs = Array.from(container.querySelectorAll('.button-row a')).map((a) =>
        a.getAttribute('href'),
      );
      expect(hrefs).toEqual(['#portfolio', '#contact']);
      const highlights = Array.from(
        container.querySelectorAll<HTMLAnchorElement>('.highlight-value a'),
      ).map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('title')]);
      expect(highlights).toEqual([
        [
          'C# / .NET',
          'https://blazor.mvcprogrammer.com/',
          'See the C# / .NET edition of this site',
        ],
        ['Angular', 'https://angular.mvcprogrammer.com/', 'See the Angular edition of this site'],
        ['React', 'https://react.mvcprogrammer.com/', 'See the React edition of this site'],
      ]);
      expect(container.querySelectorAll('.highlight-value')[1]?.textContent).toBe(
        'Angular / React',
      );
    });
  });

  describe('AboutSection', () => {
    it('should link the Angular, React, Blazor, and JavaScript tags to the four editions with a hint', () => {
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
      expect(document.querySelectorAll('.portfolio-card').length).toBe(3);
      expect(document.querySelector('.portfolio-card-featured .card-subtitle')?.textContent).toBe(
        'The tech behind this site, in four editions',
      );
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
      expect(container.querySelectorAll('.colophon-item').length).toBe(9);
    });
  });
});
