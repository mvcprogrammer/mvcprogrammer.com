import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import { SECTION_LINKS, SiteHeader } from './SiteHeader';

/** The observer callback and bookkeeping captured from a stubbed IntersectionObserver. */
interface ObserverCapture {
  callbacks: IntersectionObserverCallback[];
  observed: Element[];
  disconnects: number;
}

/** A button that navigates away, so a test can trigger a route change under the header. */
function Navigator() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate('/elsewhere')}>
      go
    </button>
  );
}

describe('SiteHeader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    window.scrollY = 0;
  });

  describe('rendering', () => {
    it('should render the six section links with the menu closed', () => {
      // Arrange, Act
      renderHeader();

      // Assert
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav-link')).map(
        (a) => [a.textContent, a.getAttribute('href')],
      );
      expect(links).toEqual(SECTION_LINKS.map((link) => [link.label, `#${link.id}`]));
      const toggle = screen.getByRole('button', { name: 'Open menu' });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(document.querySelector('.site-nav')?.classList.contains('is-open')).toBe(false);
      expect(document.querySelector('.site-header')?.classList.contains('is-scrolled')).toBe(false);
      expect(document.querySelectorAll('.nav-link[aria-current]').length).toBe(0);
    });
  });

  describe('menu', () => {
    it('should open on the toggle and relabel it', () => {
      // Arrange
      renderHeader();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

      // Assert
      const toggle = screen.getByRole('button', { name: 'Close menu' });
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(document.querySelector('.site-nav')?.classList.contains('is-open')).toBe(true);
    });

    it('should close when a nav link is clicked', () => {
      // Arrange
      renderHeader();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

      // Act
      fireEvent.click(screen.getByText('About'));

      // Assert
      expect(document.querySelector('.site-nav')?.classList.contains('is-open')).toBe(false);
    });

    it('should close on Escape and return focus to the toggle', () => {
      // Arrange
      renderHeader();
      const toggle = screen.getByRole('button', { name: 'Open menu' });
      fireEvent.click(toggle);
      toggle.blur();

      // Act
      fireEvent.keyDown(document, { key: 'Escape' });

      // Assert
      expect(document.querySelector('.site-nav')?.classList.contains('is-open')).toBe(false);
      expect(document.activeElement).toBe(toggle);
    });

    it('should close on a click outside the header but not inside it', () => {
      // Arrange
      renderHeader();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

      // Act, Assert: inside
      fireEvent.click(document.querySelector('.brand-name')!);
      expect(document.querySelector('.site-nav')?.classList.contains('is-open')).toBe(true);

      // Act, Assert: outside
      fireEvent.click(document.body);
      expect(document.querySelector('.site-nav')?.classList.contains('is-open')).toBe(false);
    });

    it('should close when the viewport grows past the breakpoint', () => {
      // Arrange
      const listeners: ((event: MediaQueryListEvent) => void)[] = [];
      vi.stubGlobal('matchMedia', (query: string) => ({
        media: query,
        matches: false,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
          listeners.push(listener),
        removeEventListener: vi.fn(),
      }));
      renderHeader();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

      // Act
      act(() =>
        listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent)),
      );

      // Assert
      expect(document.querySelector('.site-nav')?.classList.contains('is-open')).toBe(false);
    });

    it('should release the document listeners once the menu closes', () => {
      // Arrange
      const removed = vi.spyOn(document, 'removeEventListener');
      renderHeader();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

      // Act
      fireEvent.keyDown(document, { key: 'Escape' });

      // Assert
      const types = removed.mock.calls.map((call) => call[0]);
      expect(types).toContain('keydown');
      expect(types).toContain('click');
    });
  });

  describe('scroll state', () => {
    it('should draw the border once the page scrolls past the threshold and remove it at the top', () => {
      // Arrange
      renderHeader();

      // Act, Assert: scrolled
      window.scrollY = 40;
      fireEvent.scroll(window);
      expect(document.querySelector('.site-header')?.classList.contains('is-scrolled')).toBe(true);

      // Act, Assert: back at the top
      window.scrollY = 0;
      fireEvent.scroll(window);
      expect(document.querySelector('.site-header')?.classList.contains('is-scrolled')).toBe(false);
    });
  });

  describe('current section', () => {
    it('should observe the sections on the page and mark the one most in view as current', () => {
      // Arrange
      const capture = arrangeIntersectionObserver();
      arrangeSections('about', 'resume');
      renderHeader();

      // Act
      act(() =>
        capture.callbacks[0]!(
          [createEntry('about', 0.2), createEntry('resume', 0.6)],
          {} as IntersectionObserver,
        ),
      );

      // Assert
      expect(capture.observed.map((element) => element.id)).toEqual(['about', 'resume']);
      expect(document.querySelector('.nav-link[aria-current="true"]')?.textContent).toBe('Resume');
    });

    it('should clear the current section near the top of the page when nothing is in view', () => {
      // Arrange
      const capture = arrangeIntersectionObserver();
      arrangeSections('about');
      renderHeader();
      act(() => capture.callbacks[0]!([createEntry('about', 1)], {} as IntersectionObserver));
      expect(document.querySelector('.nav-link[aria-current="true"]')).not.toBeNull();

      // Act
      window.scrollY = 10;
      act(() => capture.callbacks[0]!([createEntry('about', 0)], {} as IntersectionObserver));

      // Assert
      expect(document.querySelector('.nav-link[aria-current="true"]')).toBeNull();
    });

    it('should keep the last current section further down the page when nothing is in view', () => {
      // Arrange
      const capture = arrangeIntersectionObserver();
      arrangeSections('about');
      renderHeader();
      act(() => capture.callbacks[0]!([createEntry('about', 1)], {} as IntersectionObserver));

      // Act
      window.scrollY = 900;
      act(() => capture.callbacks[0]!([createEntry('about', 0)], {} as IntersectionObserver));

      // Assert
      expect(document.querySelector('.nav-link[aria-current="true"]')?.textContent).toBe('About');
    });

    it('should create no observer when the page has no sections', () => {
      // Arrange
      const capture = arrangeIntersectionObserver();

      // Act
      renderHeader();

      // Assert
      expect(capture.callbacks.length).toBe(0);
    });

    it('should cope with a browser that has no IntersectionObserver', () => {
      // Arrange
      vi.stubGlobal('IntersectionObserver', undefined);
      arrangeSections('about');

      // Act, Assert
      expect(() => renderHeader()).not.toThrow();
    });

    it('should disconnect the observer on unmount', () => {
      // Arrange
      const capture = arrangeIntersectionObserver();
      arrangeSections('about');
      const { unmount } = renderHeader();

      // Act
      unmount();

      // Assert
      expect(capture.disconnects).toBe(1);
    });

    it('should replace the observer after a navigation', () => {
      // Arrange
      const capture = arrangeIntersectionObserver();
      arrangeSections('about');
      renderHeader(<Navigator />);

      // Act
      fireEvent.click(screen.getByText('go'));

      // Assert
      expect(capture.disconnects).toBe(1);
      expect(capture.callbacks.length).toBe(2);
    });
  });

  /** Renders the header under a memory router, with any extra element beside it. */
  function renderHeader(extra: React.ReactNode = null) {
    return render(
      <MemoryRouter>
        <SiteHeader />
        {extra}
      </MemoryRouter>,
    );
  }

  /** Puts sections with the given ids in the document ahead of the render, as the page would. */
  function arrangeSections(...ids: string[]): void {
    const main = document.createElement('main');
    for (const id of ids) {
      const section = document.createElement('section');
      section.id = id;
      main.appendChild(section);
    }
    document.body.appendChild(main);
  }

  /** Replaces IntersectionObserver with a stub that records what the header does with it. */
  function arrangeIntersectionObserver(): ObserverCapture {
    const capture: ObserverCapture = { callbacks: [], observed: [], disconnects: 0 };
    class StubObserver {
      constructor(callback: IntersectionObserverCallback) {
        capture.callbacks.push(callback);
      }
      observe(element: Element): void {
        capture.observed.push(element);
      }
      unobserve(): void {}
      disconnect(): void {
        capture.disconnects++;
      }
    }
    vi.stubGlobal('IntersectionObserver', StubObserver);
    return capture;
  }

  function createEntry(id: string, ratio: number): IntersectionObserverEntry {
    return {
      target: document.getElementById(id)!,
      isIntersecting: ratio > 0,
      intersectionRatio: ratio,
    } as unknown as IntersectionObserverEntry;
  }
});
