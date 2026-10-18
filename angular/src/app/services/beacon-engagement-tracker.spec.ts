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
  location: { hostname: string };
  window: { innerWidth: number; darkScheme: boolean };
  sections: Element[];
  visibilityState: DocumentVisibilityState;
}

const PING_OPTIONS = { keepalive: true, credentials: 'omit', cache: 'no-store' };

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
      expect(page.listeners.has('click')).toBe(true);
    });

    it('should send a load ping naming the viewport class and color scheme', () => {
      // Arrange
      page.window.innerWidth = 600;
      page.window.darkScheme = true;

      // Act
      tracker.start();

      // Assert
      expect(page.fetch).toHaveBeenCalledTimes(1);
      expect(page.fetch).toHaveBeenCalledWith('/ping?e=load&v=phone&c=dark', PING_OPTIONS);
    });

    it('should class a 900 pixel window as a tablet and a 1280 pixel one as a desktop', () => {
      // Arrange
      page.window.innerWidth = 900;

      // Act
      tracker.start();
      page.window.innerWidth = 1280;
      tracker.start();

      // Assert
      const urls = page.fetch.mock.calls.map((call) => call[0] as string);
      expect(urls).toEqual(['/ping?e=load&v=tablet&c=light', '/ping?e=load&v=desktop&c=light']);
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
      expect(page.fetch).toHaveBeenCalledTimes(2);
      expect(page.fetch).toHaveBeenLastCalledWith('/ping?e=view&s=about', PING_OPTIONS);
      expect(observer.unobserved).toEqual([page.sections[0]]);
    });

    it('should ping a click on an edition, GitHub, or profile link with where it sat', () => {
      // Arrange
      tracker.start();
      const header = element('<header class="site-header"><a href="https://angular.mvcprogrammer.com/">Angular</a></header>');
      const main = element(
        '<main><section class="section" id="about"><a href="https://github.com/mvcprogrammer">GitHub</a></section>' +
          '<section class="section" id="portfolio"><a href="https://github.com/mvcprogrammer/sandkey-display-api">API</a></section></main>',
      );
      const footer = element('<footer><a href="https://www.linkedin.com/in/mvcprogrammer/">LinkedIn</a></footer>');
      page.fetch.mockClear();

      // Act
      for (const anchor of [...header.querySelectorAll('a'), ...main.querySelectorAll('a'), ...footer.querySelectorAll('a')]) {
        click(page, anchor);
      }

      // Assert
      const urls = page.fetch.mock.calls.map((call) => call[0] as string);
      expect(urls).toEqual([
        '/ping?e=click&k=edition&t=angular&f=header',
        '/ping?e=click&k=github&t=profile&f=about',
        '/ping?e=click&k=github&t=sandkey-display-api&f=portfolio',
        '/ping?e=click&k=social&t=linkedin&f=footer',
      ]);
    });

    it('should ignore clicks on in-page links, other sites, and non-links', () => {
      // Arrange
      tracker.start();
      const main = element(
        '<main><section class="section" id="about"><a href="#resume">Resume</a><a href="https://example.com/">Elsewhere</a><span>text</span></section></main>',
      );
      page.fetch.mockClear();

      // Act
      for (const target of Array.from(main.querySelectorAll('a, span'))) {
        click(page, target);
      }

      // Assert
      expect(page.fetch).not.toHaveBeenCalled();
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
      expect(urls).toEqual(['/ping?e=load&v=desktop&c=light', '/ping?e=leave&t=42', '/ping?e=leave&t=50']);
    });

    it('should swallow a failed ping', async () => {
      // Arrange
      page.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
      tracker.start();

      // Act
      setVisibility(page, 'hidden');
      await Promise.resolve();

      // Assert
      expect(page.fetch).toHaveBeenCalledTimes(2);
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
      expect(page.listeners.size).toBe(2);
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
    const location = { hostname: 'mvcprogrammer.test' };
    const window = { innerWidth: 1280, darkScheme: false };
    const fake: FakePage = {
      listeners,
      fetch,
      location,
      window,
      sections,
      visibilityState: 'visible',
      document: null as unknown as Document,
    };
    fake.document = {
      defaultView: {
        fetch,
        location,
        get innerWidth() {
          return window.innerWidth;
        },
        matchMedia: (query: string) => {
          expect(query).toBe('(prefers-color-scheme: dark)');
          return { matches: window.darkScheme };
        },
      },
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

  /** Builds a detached DOM fragment, so closest() works as it would on the page. */
  function element(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.firstElementChild as HTMLElement;
  }

  /** Delivers a click on the target through the tracker's document listener. */
  function click(target: FakePage, element: Element): void {
    target.listeners.get('click')?.({ target: element } as unknown as Event);
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
