import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { BeaconEngagementTracker } from './beacon-engagement-tracker';

/** Stand-in for IntersectionObserver: records what is observed and lets a test fire the callback. */
class FakeIntersectionObserver {
  static readonly instances: FakeIntersectionObserver[] = [];

  readonly observed: Element[] = [];
  readonly unobserved: Element[] = [];
  disconnected = false;

  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(target: Element): void {
    this.unobserved.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Reports the given sections with whether each one intersects. */
  report(entries: readonly [Element, boolean][]): void {
    this.callback(
      entries.map(
        ([target, isIntersecting]) => ({ target, isIntersecting }) as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
}

/** The slice of the document and window the tracker touches, every piece under the test's control. */
interface FakePage {
  document: Document;
  listeners: Map<string, EventListener>;
  fetch: ReturnType<typeof vi.fn>;
  navigator: { doNotTrack?: string; globalPrivacyControl?: boolean };
  location: { hostname: string };
  sections: Element[];
  visibilityState: DocumentVisibilityState;
}

describe('BeaconEngagementTracker', () => {
  let page: FakePage;
  let tracker: BeaconEngagementTracker;

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    page = createFakePage();
    TestBed.configureTestingModule({
      providers: [BeaconEngagementTracker, { provide: DOCUMENT, useValue: page.document }],
    });
    tracker = TestBed.inject(BeaconEngagementTracker);
  });

  afterEach(() => {
    FakeIntersectionObserver.instances.length = 0;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should observe every section in main with the middle-of-viewport margin', () => {
      // Act
      tracker.start();

      // Assert
      const observer = single(FakeIntersectionObserver.instances);
      expect(observer.observed).toEqual(page.sections);
      expect(observer.options?.rootMargin).toBe('-40% 0px -40% 0px');
      expect(page.listeners.has('visibilitychange')).toBe(true);
    });

    it('should ping a view once per section that intersects and stop observing it', () => {
      // Arrange
      tracker.start();
      const observer = single(FakeIntersectionObserver.instances);

      // Act
      observer.report([
        [page.sections[0], true],
        [page.sections[1], false],
      ]);

      // Assert
      expect(page.fetch).toHaveBeenCalledTimes(1);
      expect(page.fetch).toHaveBeenCalledWith('/ping?e=view&s=about', {
        keepalive: true,
        credentials: 'omit',
        cache: 'no-store',
      });
      expect(observer.unobserved).toEqual([page.sections[0]]);
    });

    it('should ping the seconds the page was visible each time the tab is hidden', () => {
      // Arrange
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
      tracker.start();

      // Act
      vi.setSystemTime(new Date('2026-10-15T12:00:42Z'));
      setVisibility(page, 'hidden');
      vi.setSystemTime(new Date('2026-10-15T12:05:00Z'));
      setVisibility(page, 'visible');
      vi.setSystemTime(new Date('2026-10-15T12:05:08Z'));
      setVisibility(page, 'hidden');

      // Assert
      const urls = page.fetch.mock.calls.map((call) => call[0] as string);
      expect(urls).toEqual(['/ping?e=leave&t=42', '/ping?e=leave&t=50']);
    });

    it('should swallow a failed ping', async () => {
      // Arrange
      page.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
      tracker.start();

      // Act
      setVisibility(page, 'hidden');
      await Promise.resolve();

      // Assert
      expect(page.fetch).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when the browser sends Do Not Track', () => {
      // Arrange
      page.navigator.doNotTrack = '1';

      // Act
      tracker.start();

      // Assert
      expectSilent(page);
    });

    it('should do nothing when the browser sends Global Privacy Control', () => {
      // Arrange
      page.navigator.globalPrivacyControl = true;

      // Act
      tracker.start();

      // Assert
      expectSilent(page);
    });

    it('should do nothing on a local preview', () => {
      // Arrange
      page.location.hostname = 'localhost';

      // Act
      tracker.start();

      // Assert
      expectSilent(page);
    });

    it('should restart when called twice', () => {
      // Arrange
      tracker.start();
      const first = single(FakeIntersectionObserver.instances);

      // Act
      tracker.start();

      // Assert
      expect(first.disconnected).toBe(true);
      expect(FakeIntersectionObserver.instances.length).toBe(2);
      expect(page.listeners.size).toBe(1);
    });
  });

  describe('stop', () => {
    it('should disconnect the observer and remove the visibility listener', () => {
      // Arrange
      tracker.start();
      const observer = single(FakeIntersectionObserver.instances);

      // Act
      tracker.stop();

      // Assert
      expect(observer.disconnected).toBe(true);
      expect(page.listeners.size).toBe(0);
    });

    it('should be safe to call before start', () => {
      // Act
      tracker.stop();

      // Assert
      expect(page.listeners.size).toBe(0);
    });
  });

  function createFakePage(): FakePage {
    const sections = ['about', 'services'].map((id) => {
      const section = document.createElement('section');
      section.id = id;
      return section;
    });
    const listeners = new Map<string, EventListener>();
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    const navigator: FakePage['navigator'] = {};
    const location = { hostname: 'mvcprogrammer.test' };
    const fake: FakePage = {
      listeners,
      fetch,
      navigator,
      location,
      sections,
      visibilityState: 'visible',
      document: null as unknown as Document,
    };
    fake.document = {
      defaultView: { fetch, navigator, location },
      get visibilityState() {
        return fake.visibilityState;
      },
      querySelectorAll: (selector: string) => {
        expect(selector).toBe('main .section[id]');
        return sections;
      },
      addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    } as unknown as Document;
    return fake;
  }

  function setVisibility(target: FakePage, state: DocumentVisibilityState): void {
    target.visibilityState = state;
    target.listeners.get('visibilitychange')?.(new Event('visibilitychange'));
  }

  function expectSilent(target: FakePage): void {
    expect(FakeIntersectionObserver.instances.length).toBe(0);
    expect(target.listeners.size).toBe(0);
    expect(target.fetch).not.toHaveBeenCalled();
  }

  function single<T>(items: readonly T[]): T {
    expect(items.length).toBe(1);
    return items[0];
  }
});
