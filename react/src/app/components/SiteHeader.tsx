import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { SocialLinks } from './SocialLinks';

/** A nav entry: the section id it scrolls to and its label. */
export interface SectionLink {
  readonly id: string;
  readonly label: string;
}

/** The sections the nav links to, in page order. */
export const SECTION_LINKS: readonly SectionLink[] = [
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Employers' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'resume', label: 'Resume' },
  { id: 'contact', label: 'Contact' },
];

/** An edition of the site: its key, the label shown in the edition menu, and where it lives. */
export interface Edition {
  readonly key: string;
  readonly label: string;
  readonly href: string;
}

/** The four editions of the site, in the order the edition menu lists them. */
export const EDITIONS: readonly Edition[] = [
  { key: 'js', label: 'JS Edition', href: 'https://mvcprogrammer.com/' },
  { key: 'angular', label: 'Angular Edition', href: 'https://angular.mvcprogrammer.com/' },
  { key: 'react', label: 'React Edition', href: 'https://react.mvcprogrammer.com/' },
  { key: 'blazor', label: 'Blazor Edition', href: 'https://blazor.mvcprogrammer.com/' },
];

/** The key of the edition this app is; its entry in EDITIONS is marked current. */
export const CURRENT_EDITION = 'react';

const CURRENT = EDITIONS.find((e) => e.key === CURRENT_EDITION) as Edition;

/** Scrolling past this many pixels draws the header's bottom border. */
const SCROLL_THRESHOLD = 8;

/** Above this scroll offset, with no section in view, no nav link is current. */
const TOP_ZONE = 200;

/** The breakpoint at which the mobile menu becomes the desktop nav. */
const DESKTOP_QUERY = '(min-width: 52em)';

const SECTION_OBSERVER_OPTIONS: IntersectionObserverInit = {
  rootMargin: '-40% 0px -50% 0px',
  threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
};

/**
 * Sticky header with the brand, the edition menu, the section nav, and the mobile menu toggle. The
 * scroll state, the section in view, and the open menus are state; the browser events feed them
 * through effects.
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editionsOpen, setEditionsOpen] = useState(false);
  const edition = useRef<HTMLDivElement>(null);
  const editionToggle = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  /**
   * Closes the mobile menu. Called from nav links, Escape, an outside click, and the resize past the breakpoint.
   * @param returnFocus True to move focus back to the toggle button, as Escape should.
   */
  const closeMenu = useCallback((returnFocus: boolean): void => {
    setMenuOpen(false);
    if (returnFocus) {
      toggle.current?.focus();
    }
  }, []);

  /**
   * Closes the edition list. Called from Escape and an outside click.
   * @param returnFocus True to move focus back to the edition button, as Escape should.
   */
  const closeEditions = useCallback((returnFocus: boolean): void => {
    setEditionsOpen(false);
    if (returnFocus) {
      editionToggle.current?.focus();
    }
  }, []);

  // While the edition list is open: Escape or a click outside the list closes it.
  useEffect(() => {
    if (!editionsOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeEditions(true);
      }
    };
    const onClick = (event: MouseEvent): void => {
      if (edition.current !== null && !edition.current.contains(event.target as Node)) {
        closeEditions(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [editionsOpen, closeEditions]);

  // Draws the header border once the page scrolls, updating only on change.
  useEffect(() => {
    const update = (): void => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  // Marks the nav link of the section most in view with aria-current. The sections live in the
  // routed page, so the observer is (re)attached after each navigation.
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') {
      return;
    }

    const sections = SECTION_LINKS.map((link) => document.getElementById(link.id)).filter(
      (section): section is HTMLElement => section !== null,
    );
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
        setCurrent(best);
      } else if (window.scrollY < TOP_ZONE) {
        setCurrent(null);
      }
    }, SECTION_OBSERVER_OPTIONS);

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, [location.pathname]);

  // While the menu is open: Escape, a click outside the header, or growing past the breakpoint closes it.
  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeMenu(true);
      }
    };
    const onClick = (event: MouseEvent): void => {
      if (header.current !== null && !header.current.contains(event.target as Node)) {
        closeMenu(false);
      }
    };
    const onChange = (event: MediaQueryListEvent): void => {
      if (event.matches) {
        closeMenu(false);
      }
    };

    const query = typeof window.matchMedia === 'function' ? window.matchMedia(DESKTOP_QUERY) : null;
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    query?.addEventListener('change', onChange);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
      query?.removeEventListener('change', onChange);
    };
  }, [menuOpen, closeMenu]);

  return (
    <header className={scrolled ? 'site-header is-scrolled' : 'site-header'} ref={header}>
      <div className="container header-inner">
        <div className="brand-group">
          <a className="brand" href="#top" aria-label="mvcprogrammer.com, back to top">
            <span className="brand-mark" aria-hidden="true"></span>
            <span className="brand-name">mvcprogrammer.com</span>
          </a>
          <div className={editionsOpen ? 'edition is-open' : 'edition'} ref={edition}>
            <button
              className="edition-toggle"
              type="button"
              aria-haspopup="true"
              aria-expanded={editionsOpen}
              aria-controls="edition-menu"
              onClick={() => setEditionsOpen((open) => !open)}
              ref={editionToggle}
            >
              {CURRENT.label}
            </button>
            <ul className="edition-menu" id="edition-menu" role="list" aria-label="Editions of this site">
              {EDITIONS.map((item) => (
                <li key={item.key}>
                  <a
                    className="edition-link"
                    href={item.href}
                    aria-current={item.key === CURRENT_EDITION ? 'true' : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          className="nav-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
          ref={toggle}
        >
          <span className="nav-toggle-bar" aria-hidden="true"></span>
          <span className="nav-toggle-bar" aria-hidden="true"></span>
          <span className="nav-toggle-bar" aria-hidden="true"></span>
        </button>

        <nav
          className={menuOpen ? 'site-nav is-open' : 'site-nav'}
          id="primary-nav"
          aria-label="Primary"
        >
          <ul className="nav-list" role="list">
            {SECTION_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  className="nav-link"
                  href={`#${link.id}`}
                  aria-current={current === link.id ? 'true' : undefined}
                  onClick={() => closeMenu(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <SocialLinks />
        </nav>
      </div>
    </header>
  );
}
