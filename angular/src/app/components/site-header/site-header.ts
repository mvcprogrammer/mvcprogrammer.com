import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SocialLinks } from '../social-links/social-links';

/** A nav entry: the section id it scrolls to and its label. */
export interface SectionLink {
  readonly id: string;
  readonly label: string;
}

/** An edition of the site: its key, the label shown in the edition menu, and where it lives. */
export interface Edition {
  readonly key: string;
  readonly label: string;
  readonly href: string;
}

/** Site header: menu and edition-list state, scroll shadow, and the current-section highlight. */
@Component({
  selector: 'app-site-header',
  imports: [SocialLinks],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-header.html',
})
export class SiteHeader {
  /** The sections the nav links to, in page order. */
  static readonly SECTION_LINKS: readonly SectionLink[] = [
    { id: 'about', label: 'About' },
    { id: 'services', label: 'Employers' },
    { id: 'freelance', label: 'Freelance' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'resume', label: 'Resume' },
    { id: 'contact', label: 'Contact' },
  ];

  /** The four editions of the site, in the order the edition menu lists them. */
  static readonly EDITIONS: readonly Edition[] = [
    { key: 'js', label: 'JS Edition', href: 'https://mvcprogrammer.com/' },
    { key: 'angular', label: 'Angular Edition', href: 'https://angular.mvcprogrammer.com/' },
    { key: 'react', label: 'React Edition', href: 'https://react.mvcprogrammer.com/' },
    { key: 'blazor', label: 'Blazor Edition', href: 'https://blazor.mvcprogrammer.com/' },
  ];

  /** The key of the edition this app is; its entry in EDITIONS is marked current. */
  static readonly CURRENT_EDITION = 'angular';

  /** Scrolling past this many pixels draws the header's bottom border. */
  private static readonly SCROLL_THRESHOLD = 8;

  /** Above this scroll offset, with no section in view, no nav link is current. */
  private static readonly TOP_ZONE = 200;

  /** The breakpoint at which the mobile menu becomes the desktop nav. */
  private static readonly DESKTOP_QUERY = '(min-width: 52em)';

  private static readonly SECTION_OBSERVER_OPTIONS: IntersectionObserverInit = {
    rootMargin: '-40% 0px -50% 0px',
    threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
  };

  protected readonly links = SiteHeader.SECTION_LINKS;
  protected readonly editions = SiteHeader.EDITIONS;
  protected readonly currentEdition: Edition = SiteHeader.EDITIONS.find((e) => e.key === SiteHeader.CURRENT_EDITION) as Edition;
  protected readonly menuOpen = signal(false);
  protected readonly editionsOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly current = signal<string | null>(null);

  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');
  private readonly edition = viewChild.required<ElementRef<HTMLElement>>('edition');
  private readonly editionToggle = viewChild.required<ElementRef<HTMLButtonElement>>('editionToggle');
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private sectionObserver: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => this.watchScroll());

    // The sections live in the routed page, which renders after the header, so the observer is
    // (re)attached after each navigation completes.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => afterNextRender(() => this.observeSections(), { injector: this.injector }));

    // The document-level listeners exist only while the menu is open.
    effect((onCleanup) => {
      if (!this.menuOpen()) {
        return;
      }

      onCleanup(this.watchMenu());
    });

    // The same for the edition list.
    effect((onCleanup) => {
      if (!this.editionsOpen()) {
        return;
      }

      onCleanup(this.watchEditions());
    });

    this.destroyRef.onDestroy(() => this.sectionObserver?.disconnect());
  }

  /**
   * Closes the mobile menu. Called from nav links, Escape, an outside click, and the resize past the breakpoint.
   * @param returnFocus True to move focus back to the toggle button, as Escape should.
   */
  closeMenu(returnFocus: boolean): void {
    if (!this.menuOpen()) {
      return;
    }

    this.menuOpen.set(false);
    if (returnFocus) {
      this.toggle().nativeElement.focus();
    }
  }

  /**
   * Closes the edition list. Called from Escape and an outside click.
   * @param returnFocus True to move focus back to the edition button, as Escape should.
   */
  closeEditions(returnFocus: boolean): void {
    if (!this.editionsOpen()) {
      return;
    }

    this.editionsOpen.set(false);
    if (returnFocus) {
      this.editionToggle().nativeElement.focus();
    }
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected toggleEditions(): void {
    this.editionsOpen.update((open) => !open);
  }

  protected isCurrent(sectionId: string): boolean {
    return this.current() === sectionId;
  }

  private get window(): Window | null {
    return this.document.defaultView;
  }

  /** Draws the header border once the page scrolls, updating only on change. */
  private watchScroll(): void {
    const window = this.window;
    if (window === null) {
      return;
    }

    const update = (): void => this.scrolled.set(window.scrollY > SiteHeader.SCROLL_THRESHOLD);
    update();
    window.addEventListener('scroll', update, { passive: true });
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', update));
  }

  /** Marks the nav link of the section most in view with aria-current. */
  private observeSections(): void {
    this.sectionObserver?.disconnect();
    this.sectionObserver = null;

    const window = this.window;
    if (window === null || typeof IntersectionObserver !== 'function') {
      return;
    }

    const sections = this.links
      .map((link) => this.document.getElementById(link.id))
      .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) {
      return;
    }

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      }

      let best: string | null = null;
      let bestRatio = 0;
      for (const section of sections) {
        const ratio = visible.get(section.id) ?? 0;
        if (ratio > bestRatio) {
          best = section.id;
          bestRatio = ratio;
        }
      }

      if (best !== null) {
        this.current.set(best);
      } else if (window.scrollY < SiteHeader.TOP_ZONE) {
        this.current.set(null);
      }
    }, SiteHeader.SECTION_OBSERVER_OPTIONS);

    for (const section of sections) {
      observer.observe(section);
    }

    this.sectionObserver = observer;
  }

  /** While the edition list is open: Escape or a click outside the list closes it. */
  private watchEditions(): () => void {
    const edition = this.edition().nativeElement;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        this.closeEditions(true);
      }
    };
    const onClick = (event: MouseEvent): void => {
      if (!edition.contains(event.target as Node)) {
        this.closeEditions(false);
      }
    };

    this.document.addEventListener('keydown', onKey);
    this.document.addEventListener('click', onClick);

    return () => {
      this.document.removeEventListener('keydown', onKey);
      this.document.removeEventListener('click', onClick);
    };
  }

  /** While the menu is open: Escape, a click outside the header, or growing past the breakpoint closes it. */
  private watchMenu(): () => void {
    const header = this.header().nativeElement;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        this.closeMenu(true);
      }
    };
    const onClick = (event: MouseEvent): void => {
      if (!header.contains(event.target as Node)) {
        this.closeMenu(false);
      }
    };
    const onChange = (event: MediaQueryListEvent): void => {
      if (event.matches) {
        this.closeMenu(false);
      }
    };

    const window = this.window;
    const query = window !== null && typeof window.matchMedia === 'function' ? window.matchMedia(SiteHeader.DESKTOP_QUERY) : null;
    this.document.addEventListener('keydown', onKey);
    this.document.addEventListener('click', onClick);
    query?.addEventListener('change', onChange);

    return () => {
      this.document.removeEventListener('keydown', onKey);
      this.document.removeEventListener('click', onClick);
      query?.removeEventListener('change', onChange);
    };
  }
}
