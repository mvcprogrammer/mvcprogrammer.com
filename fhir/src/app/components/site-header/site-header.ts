import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { SITE_OPTIONS } from '../../configurations/site-options';

/**
 * Site header: the brand linking back to the main site, the theme toggle, and the scroll shadow. No
 * section nav and no edition menu: this app is one page and is not an edition of the site.
 */
@Component({
  selector: 'app-site-header',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-header.html',
})
export class SiteHeader {
  /** Scrolling past this many pixels draws the header's bottom border. */
  private static readonly SCROLL_THRESHOLD = 8;

  protected readonly siteUrl = inject(SITE_OPTIONS).siteUrl;
  protected readonly scrolled = signal(false);

  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.watchScroll());
  }

  /**
   * Flips between light and dark from whatever is showing now (a saved choice, else the OS) and saves
   * the choice for theme.js to apply on the next visit. No state: the stylesheet picks the button's
   * icon from the same data-theme and prefers-color-scheme.
   */
  protected toggleTheme(): void {
    const root = this.document.documentElement;
    const window = this.document.defaultView;
    const saved = root.getAttribute('data-theme');
    const osDark = window !== null && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const current = saved === 'light' || saved === 'dark' ? saved : osDark ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      window?.localStorage.setItem('theme', next);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  }

  /** Draws the header border once the page scrolls, updating only on change. */
  private watchScroll(): void {
    const window = this.document.defaultView;
    if (window === null) {
      return;
    }

    const update = (): void => this.scrolled.set(window.scrollY > SiteHeader.SCROLL_THRESHOLD);
    update();
    window.addEventListener('scroll', update, { passive: true });
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', update));
  }
}
