import type { EngagementTracker } from '../interfaces/engagement-tracker';

/** What a followed link pointed at, as the click ping reports it. */
interface TrackedLink {
  readonly kind: 'edition' | 'github' | 'social';
  readonly target: string;
}

/**
 * The engagement beacon, mirroring main.js: small GET /ping requests the CloudFront edge answers
 * with 204 and tools/cf-stats.mjs reads back from the access logs. "load" once, with the viewport
 * class and color scheme; "view" once per section that reaches the middle of the viewport; "click"
 * when a link to another edition of the site or to the GitHub, LinkedIn, or Flickr profile is
 * followed, with which link and which part of the page it sat in; and "leave" with the seconds
 * visible each time the tab is hidden. No cookies and no identifiers; does nothing when the page
 * runs locally.
 */
export class BeaconEngagementTracker implements EngagementTracker {
  /** Same-origin path CloudFront answers with 204 and records in its access logs. */
  static readonly PING_PATH = '/ping';

  /** Hostnames the beacon stays silent on, so local previews do not reach the live logs. */
  static readonly LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];

  /** The hosts of the four editions, keyed to the name the click ping reports. */
  static readonly EDITION_HOSTS: Readonly<Record<string, string>> = {
    'mvcprogrammer.com': 'js',
    'www.mvcprogrammer.com': 'js',
    'angular.mvcprogrammer.com': 'angular',
    'react.mvcprogrammer.com': 'react',
    'blazor.mvcprogrammer.com': 'blazor',
  };

  /** Phones below this many pixels wide, the same band the stylesheet uses. */
  private static readonly PHONE_MAX_WIDTH = 768;

  /** Tablets below this many pixels wide; desktops from there. */
  private static readonly TABLET_MAX_WIDTH = 1024;

  /** The middle fifth of the viewport: a section was scrolled to, not just past. */
  private static readonly VIEW_OBSERVER_OPTIONS: IntersectionObserverInit = {
    rootMargin: '-40% 0px -40% 0px',
  };

  private readonly document: Document;
  private observer: IntersectionObserver | null = null;
  private onVisibility: (() => void) | null = null;
  private onClick: ((event: Event) => void) | null = null;

  /**
   * @param document The document to watch, the global one unless a test supplies another.
   */
  constructor(document: Document = globalThis.document) {
    this.document = document;
  }

  /**
   * Says what a link points at, or null when it is not one the beacon reports. Only absolute links
   * qualify, so the in-page section links never match the edition's own host.
   * @param anchor The link that was followed.
   */
  static classifyLink(anchor: HTMLAnchorElement): TrackedLink | null {
    const href = anchor.getAttribute('href') ?? '';
    if (!/^https?:/i.test(href)) {
      return null;
    }

    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return null;
    }

    const host = url.hostname.toLowerCase();
    const edition = BeaconEngagementTracker.EDITION_HOSTS[host];
    if (edition !== undefined && (url.pathname === '/' || url.pathname === '')) {
      return { kind: 'edition', target: edition };
    }
    if (host === 'github.com' || host === 'www.github.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      return { kind: 'github', target: parts.length > 1 ? parts[1]! : 'profile' };
    }
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
      return { kind: 'social', target: 'linkedin' };
    }
    if (host === 'flickr.com' || host.endsWith('.flickr.com')) {
      return { kind: 'social', target: 'flickr' };
    }
    return null;
  }

  /**
   * Names the part of the page a link sits in: the header, the footer, or the id of its section.
   * @param anchor The link that was followed.
   */
  static linkPlace(anchor: HTMLAnchorElement): string {
    if (anchor.closest('.site-header') !== null) {
      return 'header';
    }
    if (anchor.closest('footer') !== null) {
      return 'footer';
    }
    return anchor.closest('main .section[id]')?.id ?? 'page';
  }

  /** @inheritdoc */
  start(): void {
    this.stop();

    const window = this.document.defaultView;
    if (window === null || !this.isEnabled(window)) {
      return;
    }

    const viewport =
      window.innerWidth < BeaconEngagementTracker.PHONE_MAX_WIDTH
        ? 'phone'
        : window.innerWidth < BeaconEngagementTracker.TABLET_MAX_WIDTH
          ? 'tablet'
          : 'desktop';
    const scheme =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    this.ping(window, `e=load&v=${viewport}&c=${scheme}`);

    const sections = this.document.querySelectorAll('main .section[id]');
    if (typeof IntersectionObserver === 'function' && sections.length > 0) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          observer.unobserve(entry.target);
          this.ping(window, `e=view&s=${encodeURIComponent(entry.target.id)}`);
        }
      }, BeaconEngagementTracker.VIEW_OBSERVER_OPTIONS);
      for (const section of Array.from(sections)) {
        observer.observe(section);
      }

      this.observer = observer;
    }

    this.onClick = (event: Event): void => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null | undefined;
      if (!anchor) {
        return;
      }

      const link = BeaconEngagementTracker.classifyLink(anchor);
      if (link === null) {
        return;
      }

      const place = encodeURIComponent(BeaconEngagementTracker.linkPlace(anchor));
      this.ping(window, `e=click&k=${link.kind}&t=${encodeURIComponent(link.target)}&f=${place}`);
    };
    this.document.addEventListener('click', this.onClick);

    let visibleSince: number | null =
      this.document.visibilityState === 'hidden' ? null : Date.now();
    let visibleMs = 0;
    this.onVisibility = (): void => {
      if (this.document.visibilityState === 'hidden') {
        if (visibleSince !== null) {
          visibleMs += Date.now() - visibleSince;
          visibleSince = null;
        }

        this.ping(window, `e=leave&t=${Math.round(visibleMs / 1000)}`);
      } else if (visibleSince === null) {
        visibleSince = Date.now();
      }
    };
    this.document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** @inheritdoc */
  stop(): void {
    this.observer?.disconnect();
    this.observer = null;

    if (this.onClick !== null) {
      this.document.removeEventListener('click', this.onClick);
      this.onClick = null;
    }

    if (this.onVisibility !== null) {
      this.document.removeEventListener('visibilitychange', this.onVisibility);
      this.onVisibility = null;
    }
  }

  /** False when fetch is missing or the page runs locally. */
  private isEnabled(window: Window): boolean {
    return (
      typeof window.fetch === 'function' &&
      !BeaconEngagementTracker.LOCAL_HOSTS.includes(window.location.hostname)
    );
  }

  /** Fire-and-forget GET; keepalive lets the leave ping outlive the tab. Failures are ignored. */
  private ping(window: Window, query: string): void {
    window
      .fetch(`${BeaconEngagementTracker.PING_PATH}?${query}`, {
        keepalive: true,
        credentials: 'omit',
        cache: 'no-store',
      })
      .catch(() => undefined);
  }
}
