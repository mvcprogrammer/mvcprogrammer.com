import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Event as RouterEvent, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SiteHeader } from './site-header';

/** Stand-in for the browser's IntersectionObserver: records what is observed and lets a test fire the callback. */
class FakeIntersectionObserver {
  static readonly instances: FakeIntersectionObserver[] = [];

  readonly observed: Element[] = [];
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

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Reports the given sections as the only visible ones, with their ratios. */
  report(entries: readonly [Element, number][]): void {
    this.callback(
      entries.map(([target, ratio]) => ({ target, isIntersecting: ratio > 0, intersectionRatio: ratio }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    );
  }
}

describe('SiteHeader', () => {
  let routerEvents: Subject<RouterEvent>;
  let fixture: ComponentFixture<SiteHeader>;
  let host: HTMLElement;
  const sections: HTMLElement[] = [];

  beforeEach(async () => {
    routerEvents = new Subject<RouterEvent>();
    await TestBed.configureTestingModule({
      imports: [SiteHeader],
      providers: [{ provide: Router, useValue: { events: routerEvents.asObservable() } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SiteHeader);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    for (const section of sections.splice(0)) {
      section.remove();
    }
    FakeIntersectionObserver.instances.length = 0;
    vi.unstubAllGlobals();
  });

  describe('render', () => {
    it('should render the brand, the six nav links in order, and the social links', () => {
      // Assert
      const labels = Array.from(host.querySelectorAll('.nav-link')).map((link) => link.textContent?.trim());
      expect(labels).toEqual(['About', 'Employers', 'Freelance', 'Portfolio', 'Resume', 'Contact']);
      const hrefs = Array.from(host.querySelectorAll<HTMLAnchorElement>('.nav-link')).map((link) => link.getAttribute('href'));
      expect(hrefs).toEqual(['#about', '#services', '#freelance', '#portfolio', '#resume', '#contact']);
      expect(host.querySelector('.brand')?.getAttribute('href')).toBe('#top');
      expect(host.querySelectorAll('.social-link').length).toBe(3);
      expect(host.querySelector('.site-header')?.classList.contains('is-scrolled')).toBe(false);
    });

    it('should start with the menu closed and no current link', () => {
      // Assert
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(toggle().getAttribute('aria-label')).toBe('Open menu');
      expect(nav().classList.contains('is-open')).toBe(false);
      expect(host.querySelector('[aria-current]')).toBeNull();
    });
  });

  describe('toggleMenu', () => {
    it('should open the menu and update the toggle', async () => {
      // Act
      toggle().click();
      await fixture.whenStable();

      // Assert
      expect(nav().classList.contains('is-open')).toBe(true);
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(toggle().getAttribute('aria-label')).toBe('Close menu');
    });

    it('should close the menu on the second press', async () => {
      // Arrange
      toggle().click();
      await fixture.whenStable();

      // Act
      toggle().click();
      await fixture.whenStable();

      // Assert
      expect(nav().classList.contains('is-open')).toBe(false);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('closeMenu', () => {
    it('should close when a nav link is clicked', async () => {
      // Arrange
      toggle().click();
      await fixture.whenStable();

      // Act
      host.querySelector<HTMLAnchorElement>('.nav-link')?.click();
      await fixture.whenStable();

      // Assert
      expect(nav().classList.contains('is-open')).toBe(false);
    });

    it('should close on Escape and return focus to the toggle', async () => {
      // Arrange
      toggle().click();
      await fixture.whenStable();

      // Act
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();

      // Assert
      expect(nav().classList.contains('is-open')).toBe(false);
      expect(document.activeElement).toBe(toggle());
    });

    it('should close on a click outside the header', async () => {
      // Arrange
      toggle().click();
      await fixture.whenStable();

      // Act
      document.body.click();
      await fixture.whenStable();

      // Assert
      expect(nav().classList.contains('is-open')).toBe(false);
    });

    it('should stay open on a click inside the header', async () => {
      // Arrange
      toggle().click();
      await fixture.whenStable();

      // Act
      host.querySelector<HTMLElement>('.brand-name')?.click();
      await fixture.whenStable();

      // Assert
      expect(nav().classList.contains('is-open')).toBe(true);
    });

    it('should ignore document events once the menu is closed again', async () => {
      // Arrange
      toggle().click();
      await fixture.whenStable();
      toggle().click();
      await fixture.whenStable();
      toggle().blur();

      // Act
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();

      // Assert
      expect(document.activeElement).not.toBe(toggle());
    });
  });

  describe('scroll', () => {
    it('should add the scrolled class past the threshold and remove it back at the top', async () => {
      // Arrange
      Object.defineProperty(window, 'scrollY', { value: 20, configurable: true });

      // Act
      window.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();

      // Assert
      expect(host.querySelector('.site-header')?.classList.contains('is-scrolled')).toBe(true);

      // Act again
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();

      // Assert again
      expect(host.querySelector('.site-header')?.classList.contains('is-scrolled')).toBe(false);
    });
  });

  describe('observeSections', () => {
    it('should observe every section after navigation and mark the one most in view', async () => {
      // Arrange
      vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
      const about = addSection('about');
      const services = addSection('services');

      // Act
      routerEvents.next(new NavigationEnd(1, '/', '/'));
      await fixture.whenStable();

      // Assert
      const observer = FakeIntersectionObserver.instances[0];
      expect(observer.observed).toEqual([about, services]);
      expect(observer.options?.rootMargin).toBe('-40% 0px -50% 0px');

      // Act again
      observer.report([
        [about, 0.2],
        [services, 0.6],
      ]);
      await fixture.whenStable();

      // Assert again
      const current = Array.from(host.querySelectorAll('.nav-link[aria-current="true"]')).map((link) => link.getAttribute('href'));
      expect(current).toEqual(['#services']);
    });

    it('should clear the current link near the top when nothing is in view', async () => {
      // Arrange
      vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
      const about = addSection('about');
      routerEvents.next(new NavigationEnd(1, '/', '/'));
      await fixture.whenStable();
      const observer = FakeIntersectionObserver.instances[0];
      observer.report([[about, 1]]);
      await fixture.whenStable();
      expect(host.querySelector('[aria-current]')).not.toBeNull();

      // Act
      observer.report([[about, 0]]);
      await fixture.whenStable();

      // Assert
      expect(host.querySelector('[aria-current]')).toBeNull();
    });

    it('should replace the observer on a later navigation and disconnect it on destroy', async () => {
      // Arrange
      vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
      addSection('about');
      routerEvents.next(new NavigationEnd(1, '/', '/'));
      await fixture.whenStable();

      // Act
      routerEvents.next(new NavigationEnd(2, '/', '/'));
      await fixture.whenStable();
      fixture.destroy();

      // Assert
      expect(FakeIntersectionObserver.instances.length).toBe(2);
      expect(FakeIntersectionObserver.instances[0].disconnected).toBe(true);
      expect(FakeIntersectionObserver.instances[1].disconnected).toBe(true);
    });

    it('should do nothing when the browser has no IntersectionObserver', async () => {
      // Arrange
      addSection('about');

      // Act
      routerEvents.next(new NavigationEnd(1, '/', '/'));
      await fixture.whenStable();

      // Assert
      expect(host.querySelector('[aria-current]')).toBeNull();
    });
  });

  function toggle(): HTMLButtonElement {
    return host.querySelector<HTMLButtonElement>('.nav-toggle') as HTMLButtonElement;
  }

  function nav(): HTMLElement {
    return host.querySelector<HTMLElement>('.site-nav') as HTMLElement;
  }

  function addSection(id: string): HTMLElement {
    const section = document.createElement('section');
    section.id = id;
    document.body.appendChild(section);
    sections.push(section);
    return section;
  }
});
