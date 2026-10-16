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
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: undefined,
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
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]![0]).toBe('/ping?e=view&s=about');
      expect(fetchSpy.mock.calls[0]![1]).toEqual({
        keepalive: true,
        credentials: 'omit',
        cache: 'no-store',
      });
    });

    it('should not ping for a section that is not intersecting', () => {
      // Arrange
      tracker.start();

      // Act
      capture.callback(
        [createEntry(document.getElementById('about')!, false)],
        {} as IntersectionObserver,
      );

      // Assert
      expect(fetchSpy).not.toHaveBeenCalled();
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
      const leaves = fetchSpy.mock.calls.map((call) => call[0]);
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

    it('should stay silent when the browser sends Do Not Track', () => {
      // Arrange
      Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });

      // Act
      tracker.start();

      // Assert
      expect(capture.observed).toEqual([]);
    });

    it('should stay silent when the browser sends Global Privacy Control', () => {
      // Arrange
      Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });

      // Act
      tracker.start();

      // Assert
      expect(capture.observed).toEqual([]);
    });

    it('should still report leaves when IntersectionObserver is missing', () => {
      // Arrange
      vi.stubGlobal('IntersectionObserver', undefined);
      tracker.start();

      // Act
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Assert
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]![0]).toMatch(/^\/ping\?e=leave&t=\d+$/);
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
      expect(fetchSpy).toHaveBeenCalledTimes(1);
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
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

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
