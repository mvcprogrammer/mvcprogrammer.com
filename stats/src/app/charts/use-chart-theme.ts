import { useEffect, useState } from 'react';

/** The colors and font the charts draw with, read from the stylesheet's tokens so both themes match the page. */
export interface ChartTheme {
  readonly accent: string;
  readonly accentSoft: string;
  readonly muted: string;
  readonly text: string;
  readonly border: string;
  readonly surface: string;
  readonly fontFamily: string;
  /** Six categorical colors for editions and places. */
  readonly ramp: readonly string[];
}

const FALLBACK: ChartTheme = {
  accent: '#2f62d9',
  accentSoft: 'rgba(53, 116, 240, 0.10)',
  muted: '#5a5d63',
  text: '#1e1f22',
  border: '#dfe1e5',
  surface: '#ffffff',
  fontFamily: 'Inter, system-ui, sans-serif',
  ramp: ['#2f62d9', '#d9712f', '#2f9e73', '#8f52d9', '#d93f6b', '#4f9fd9'],
};

/**
 * The theme as the page currently renders it. The tokens use light-dark(), which getComputedStyle
 * returns unresolved on the root, so each one is read as the computed color of a probe element
 * carrying one of the stats.css `tok-*` classes. Falls back to the light Rider palette where a
 * token is missing (tests).
 */
export function readChartTheme(): ChartTheme {
  if (typeof document === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return FALLBACK;
  }
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(probe);
  const color = (className: string, fallback: string) => {
    probe.className = className;
    const value = window.getComputedStyle(probe).color;
    return value === '' || value === 'rgba(0, 0, 0, 0)' ? fallback : value;
  };
  try {
    return {
      accent: color('tok-accent', FALLBACK.accent),
      accentSoft: color('tok-accent-soft', FALLBACK.accentSoft),
      muted: color('tok-muted', FALLBACK.muted),
      text: color('tok-text', FALLBACK.text),
      border: color('tok-border', FALLBACK.border),
      surface: color('tok-surface', FALLBACK.surface),
      fontFamily: window.getComputedStyle(document.body).fontFamily || FALLBACK.fontFamily,
      ramp: FALLBACK.ramp.map((fallback, index) => color(`tok-chart-${index + 1}`, fallback)),
    };
  } finally {
    probe.remove();
  }
}

/** The chart theme, re-read when the OS switches between light and dark. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readChartTheme);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    // The tokens flip on the next frame after the media query, so read them a moment later.
    const onChange = () => window.requestAnimationFrame(() => setTheme(readChartTheme()));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return theme;
}
