import { cleanup } from '@testing-library/react';
import { createElement } from 'react';

// Chart.js draws on a canvas, which jsdom does not have. The chart components are replaced with a
// stub that renders the chart's labels and datasets as data attributes, so a panel test can check
// what would have been drawn without a canvas.
vi.mock('react-chartjs-2', () => {
  const stub = (type: string) =>
    function ChartStub(props: { data: { labels?: unknown[]; datasets: Array<{ label?: string; data: unknown[] }> } }) {
      return createElement('div', {
        'data-testid': `chart-${type}`,
        'data-labels': JSON.stringify(props.data.labels ?? []),
        'data-datasets': JSON.stringify(props.data.datasets.map((dataset) => ({ label: dataset.label, data: dataset.data }))),
      });
    };
  return { Line: stub('line'), Bar: stub('bar'), Doughnut: stub('doughnut') };
});

// jsdom has no matchMedia; the chart theme listens for the color scheme changing.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}

// jsdom has no ResizeObserver; the chart frames observe their size.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Unmount whatever a test rendered so the next one starts from an empty document.
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});
