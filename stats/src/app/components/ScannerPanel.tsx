import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { SeriesPoint } from '../aggregation/series';
import { useChartTheme } from '../charts/use-chart-theme';
import { formatDayShort, formatNumber, formatPercent } from '../formatters/format';
import { TableTwin } from './TableTwin';

/** Props of ScannerPanel. */
export interface ScannerPanelProps {
  readonly points: readonly SeriesPoint[];
  readonly weekly: boolean;
}

/** Requests against scanner requests per period, for operations; collapsed by default and hidden when there is nothing. */
export function ScannerPanel({ points, weekly }: ScannerPanelProps) {
  const theme = useChartTheme();
  const total = points.reduce((sum, point) => sum + point.requests, 0);
  if (total === 0) {
    return null;
  }
  const scanners = points.reduce((sum, point) => sum + point.scannerRequests, 0);
  const labels = points.map((point) => (weekly ? `Week of ${formatDayShort(point.key)}` : formatDayShort(point.key)));
  const data: ChartData<'line', number[], string> = {
    labels,
    datasets: [
      { label: 'Requests', data: points.map((point) => point.requests), borderColor: theme.muted, backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.25 },
      { label: 'Scanner requests', data: points.map((point) => point.scannerRequests), borderColor: theme.ramp[4] ?? theme.accent, backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.25 },
    ],
  };
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom', labels: { color: theme.muted, boxWidth: 12, font: { family: theme.fontFamily, size: 11 } } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.muted, maxTicksLimit: 10, maxRotation: 0, font: { family: theme.fontFamily, size: 11 } } },
      y: { beginAtZero: true, grid: { color: theme.border }, ticks: { color: theme.muted, precision: 0, font: { family: theme.fontFamily, size: 11 } } },
    },
  };
  return (
    <section className="panel panel-wide" aria-label="Scanner share">
      <details className="ops">
        <summary>
          Scanner share: {formatPercent(scanners / total)} of {formatNumber(total)} requests were bots, empty user agents, or 4xx probes (operations)
        </summary>
        <div className="chart-frame is-short" role="figure" aria-label="Requests and scanner requests per period">
          <Line data={data} options={options} />
        </div>
        <TableTwin name="Scanner share" columns={['Period', 'Requests', 'Scanner requests']} rows={points.map((point, index) => [labels[index] ?? point.key, formatNumber(point.requests), formatNumber(point.scannerRequests)])} />
      </details>
    </section>
  );
}
