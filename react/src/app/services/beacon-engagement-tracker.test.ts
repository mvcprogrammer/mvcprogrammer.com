import { BeaconEngagementTracker } from './beacon-engagement-tracker';

/** The observer callback and the observed elements, captured from a stubbed IntersectionObserver. */
interface ObserverCapture {
  callback: IntersectionObserverCallback;
  observed: Element[];
  unobserved: Element[];
  disconnects: number;
  options: IntersectionObserverInit | undefined;
}

describe('BeaconEngagementTracker', () => {
  let fetchSpy: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;
  let capture: ObserverCapture;
  let tracker: BeaconEngagementTracker;

  beforeEach(() => {
    document.body.innerHTML =
      '<main><section class="section" id="about"></section><section class="section" id="resume"></section><section class="hero"></section></main>';
    fetchSpy = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchSpy);
    capture = arrangeIntersectionObserver();
    vi.stubGlobal('IntersectionObserver', capture.constructor);
    Object.defineProperty(window, 'location', {
      value: new URL('https://react.mvcprogrammer.com/'),
      configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({ matches: false }),
      configurable: true,
    });
    tracker = new BeaconEngagementTracker();
  });

  afterEach(() => {
    tracker.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('start', () => {
    it('should observe every section with an id inside main and ping once when one reaches the middle of the viewport', () => {
      // Arrange

      // Act
      tracker.start();
      const about = document.getElementById('about')!;
      capture.callback([createEntry(about, true)], {} as IntersectionObserver);

      // Assert
      expect(capture.observed.map((element) => element.id)).toEqual(['about', 'resume']);
      expect(capture.options).toEqual({ rootMargin: '-40% 0px -40% 0px' });
      expect(capture.unobserved).toEqual([about]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1]![0]).toBe('/ping?e=view&s=about');
      expect(fetchSpy.mock.calls[1]![1]).toEqual({
        keepalive: true,
        credentials: 'omit',
        cache: 'no-store',
      });
    });

    it('should send a load ping first, naming the viewport class and color scheme', () => {
      // Arrange
      Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        value: () => ({ matches: true }),
        configurable: true,
      });

      // Act
      tracker.start();

      // Assert
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]![0]).toBe('/ping?e=load&v=phone&c=dark');
    });

    it('should class a 900 pixel window as a tablet and a 1280 pixel one as a desktop', () => {
      // Arrange
      Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true });

      // Act
      tracker.start();
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
      tracker.start();

      // Assert
      const loads = fetchSpy.mock.calls.map((call) => call[0]);
      expect(loads).toEqual(['/ping?e=load&v=tablet&c=light', '/ping?e=load&v=desktop&c=light']);
    });

    it('should ping a click on an edition, GitHub, or profile link with where it sat', () => {
      // Arrange
      document.body.innerHTML =
        '<header class="site-header"><a href="https://angular.mvcprogrammer.com/">Angular</a></header>' +
        '<main><section class="section" id="about"><a href="https://github.com/mvcprogrammer">GitHub</a></section>' +
        '<section class="section" id="portfolio"><a href="https://github.com/mvcprogrammer/sandkey-display-api">API</a></section></main>' +
        '<footer><a href="https://www.linkedin.com/in/mvcprogrammer/">LinkedIn</a></footer>';
      document.addEventListener('click', (event) => event.preventDefault(), true);
      tracker.start();
      fetchSpy.mockClear();

      // Act
      for (const anchor of Array.from(document.querySelectorAll('a'))) {
        anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }

      // Assert
      const urls = fetchSpy.mock.calls.map((call) => call[0]);
      expect(urls).toEqual([
        '/ping?e=click&k=edition&t=angular&f=header',
        '/ping?e=click&k=github&t=profile&f=about',
        '/ping?e=click&k=github&t=sandkey-display-api&f=portfolio',
        '/ping?e=click&k=social&t=linkedin&f=footer',
      ]);
    });

    it('should ignore clicks on in-page links, other sites, and non-links', () => {
      // Arrange
      document.body.innerHTML =
        '<main><section class="section" id="about"><a href="#resume">Resume</a><a href="https://example.com/">Elsewhere</a><span>text</span></section></main>';
      document.addEventListener('click', (event) => event.preventDefault(), true);
      tracker.start();
      fetchSpy.mockClear();

      // Act
      for (const target of Array.from(document.querySelectorAll('a, span'))) {
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }

      // Assert
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should not ping for a section that is not intersecting', () => {
      // Arrange
      tracker.start();

      // Act
      capture.callback(
        [createEntry(document.getElementById('about')!, false)],
        {} as IntersectionObserver,
      );

      // Assert: only the load ping went out
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]![0]).toBe('/ping?e=load&v=desktop&c=light');
    });

    it('should send a leave ping with the seconds the page was visible when the tab is hidden', () => {
      // Arrange
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
      tracker.start();
      vi.setSystemTime(new Date('2026-10-16T12:00:42.400Z'));

      // Act
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Assert
      expect(fetchSpy).toHaveBeenCalledWith('/ping?e=leave&t=42', {
        keepalive: true,
        credentials: 'omit',
        cache: 'no-store',
      });
    });

    it('should accumulate visible time across hide and show cycles', () => {
      // Arrange
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
      tracker.start();

      // Act: visible 10 s, hidden 100 s, visible 5 s
      vi.setSystemTime(new Date('2026-10-16T12:00:10Z'));
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.setSystemTime(new Date('2026-10-16T12:01:50Z'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.setSystemTime(new Date('2026-10-16T12:01:55Z'));
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Assert
      const leaves = fetchSpy.mock.calls.map((call) => call[0]).filter((url) => String(url).startsWith('/ping?e=leave'));
      expect(leaves).toEqual(['/ping?e=leave&t=10', '/ping?e=leave&t=15']);
    });

    it('should stay silent on localhost', () => {
      // Arrange
      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost:5173/'),
        configurable: true,
      });

      // Act
      tracker.start();
      document.dispatchEvent(new Event('visibilitychange'));

      // Assert
      expect(capture.observed).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should still report leaves when IntersectionObserver is missing', () => {
      // Arrange
      vi.stubGlobal('IntersectionObserver', undefined);
      tracker.start();

      // Act
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Assert
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1]![0]).toMatch(/^\/ping\?e=leave&t=\d+$/);
    });

    it('should ignore a failed ping', async () => {
      // Arrange
      fetchSpy.mockRejectedValue(new TypeError('offline'));
      tracker.start();

      // Act
      capture.callback(
        [createEntry(document.getElementById('about')!, true)],
        {} as IntersectionObserver,
      );
      await Promise.resolve();

      // Assert: nothing thrown, and the tracker keeps working
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should restart cleanly when called twice', () => {
      // Arrange
      tracker.start();

      // Act
      tracker.start();

      // Assert
      expect(capture.disconnects).toBe(1);
      expect(capture.observed.length).toBe(4);
    });
  });

  describe('stop', () => {
    it('should disconnect the observer and stop listening for visibility changes', () => {
      // Arrange
      tracker.start();

      // Act
      tracker.stop();
      fetchSpy.mockClear();
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // Assert
      expect(capture.disconnects).toBe(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should be safe to call before start', () => {
      // Arrange

      // Act, Assert
      expect(() => tracker.stop()).not.toThrow();
    });
  });

  /** Replaces IntersectionObserver with a stub that records what the tracker does with it. */
  function arrangeIntersectionObserver(): ObserverCapture & {
    constructor: typeof IntersectionObserver;
  } {
    const result = {
      callback: (() => undefined) as IntersectionObserverCallback,
      observed: [] as Element[],
      unobserved: [] as Element[],
      disconnects: 0,
      options: undefined as IntersectionObserverInit | undefined,
    };
    class StubObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        result.callback = callback;
        result.options = options;
      }
      observe(element: Element): void {
        result.observed.push(element);
      }
      unobserve(element: Element): void {
        result.unobserved.push(element);
      }
      disconnect(): void {
        result.disconnects++;
      }
    }
    return Object.assign(result, {
      constructor: StubObserver as unknown as typeof IntersectionObserver,
    });
  }

  function createEntry(target: Element, isIntersecting: boolean): IntersectionObserverEntry {
    return {
      target,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
    } as unknown as IntersectionObserverEntry;
  }
});
