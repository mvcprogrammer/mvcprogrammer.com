import type { EngagementTracker } from '../interfaces/engagement-tracker';

/**
 * The engagement beacon, mirroring main.js: GET /ping?e=view&s=<id> once per section that reaches
 * the middle of the viewport, and GET /ping?e=leave&t=<seconds visible> each time the tab is
 * hidden. CloudFront answers 204 at the edge and the access logs feed tools/cf-stats.mjs. No
 * cookies and no identifiers; does nothing when the browser asks not to be tracked or the page
 * runs locally.
 */
export class BeaconEngagementTracker implements EngagementTracker {
  /** Same-origin path CloudFront answers with 204 and records in its access logs. */
  static readonly PING_PATH = '/ping';

  /** Hostnames the beacon stays silent on, so local previews do not reach the live logs. */
  static readonly LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];

  /** The middle fifth of the viewport: a section was scrolled to, not just past. */
  private static readonly VIEW_OBSERVER_OPTIONS: IntersectionObserverInit = {
    rootMargin: '-40% 0px -40% 0px',
  };

  private readonly document: Document;
  private observer: IntersectionObserver | null = null;
  private onVisibility: (() => void) | null = null;

  /**
   * @param document The document to watch, the global one unless a test supplies another.
   */
  constructor(document: Document = globalThis.document) {
    this.document = document;
  }

  /** @inheritdoc */
  start(): void {
    this.stop();

    const window = this.document.defaultView;
    if (window === null || !this.isEnabled(window)) {
      return;
    }

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

    if (this.onVisibility !== null) {
      this.document.removeEventListener('visibilitychange', this.onVisibility);
      this.onVisibility = null;
    }
  }

  /** False when fetch is missing, the browser sends Do Not Track or Global Privacy Control, or the page runs locally. */
  private isEnabled(window: Window): boolean {
    const navigator = window.navigator as Navigator & { globalPrivacyControl?: boolean };
    const optedOut = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
    return (
      typeof window.fetch === 'function' &&
      !optedOut &&
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
