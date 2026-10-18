import type { ChartData, ChartOptions, Plugin } from 'chart.js';
import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { SeriesPoint } from '../aggregation/series';
import { useChartTheme } from '../charts/use-chart-theme';
import { formatDayShort, formatDuration, formatNumber, formatPercent } from '../formatters/format';
import { TableTwin } from './TableTwin';

/** The metrics the switcher offers. */
export const METRICS = ['visits', 'beacon', 'time', 'clicks'] as const;

/** One of the main chart's metrics. */
export type Metric = (typeof METRICS)[number];

const METRIC_LABELS: Readonly<Record<Metric, string>> = { visits: 'Visits and visitors', beacon: 'Beacon reach', time: 'Time on page', clicks: 'Edition clicks' };

/** Props of TimeSeriesChart. */
export interface TimeSeriesChartProps {
  readonly points: readonly SeriesPoint[];
  /** The previous period's points, aligned by position, when Compare is on. */
  readonly previous?: readonly SeriesPoint[] | null;
  /** True when each point is a week. */
  readonly weekly: boolean;
  /** Called with a point's key when it is clicked, to narrow the range. */
  readonly onPick?: (key: string) => void;
}

function pick(metric: Metric, point: SeriesPoint): number | null {
  switch (metric) {
    case 'visits':
      return point.visits;
    case 'beacon':
      return point.beaconReach === null ? null : point.beaconReach * 100;
    case 'time':
      return point.medianSeconds;
    case 'clicks':
      return point.editionClicks;
  }
}

function formatValue(metric: Metric, value: number | null): string {
  if (value === null) {
    return '–';
  }
  switch (metric) {
    case 'beacon':
      return formatPercent(value / 100);
    case 'time':
      return formatDuration(value);
    default:
      return formatNumber(value);
  }
}

/** Shades the columns of points that have no day file, so a gap is never read as a quiet day. */
function missingShadePlugin(indices: readonly number[], color: string): Plugin<'line'> {
  return {
    id: 'missingShade',
    beforeDatasetsDraw(chart) {
      const x = chart.scales['x'];
      if (x === undefined || indices.length === 0) {
        return;
      }
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.fillStyle = color;
      for (const index of indices) {
        const left = x.getPixelForValue(index - 0.5);
        const right = x.getPixelForValue(index + 0.5);
        ctx.fillRect(Math.max(left, chartArea.left), chartArea.top, Math.min(right, chartArea.right) - Math.max(left, chartArea.left), chartArea.height);
      }
      ctx.restore();
    },
  };
}

/** The main chart: the chosen metric per day (or week), the previous period dashed, missing days shaded, and a table twin. */
export function TimeSeriesChart({ points, previous = null, weekly, onPick }: TimeSeriesChartProps) {
  const [metric, setMetric] = useState<Metric>('visits');
  const theme = useChartTheme();

  const labels = points.map((point) => (weekly ? `Week of ${formatDayShort(point.key)}` : formatDayShort(point.key)));
  const data = useMemo<ChartData<'line', (number | null)[], string>>(() => {
    const datasets: ChartData<'line', (number | null)[], string>['datasets'] = [
      {
        label: metric === 'visits' ? 'Visits' : METRIC_LABELS[metric],
        data: points.map((point) => pick(metric, point)),
        borderColor: theme.accent,
        backgroundColor: theme.accentSoft,
        fill: metric !== 'visits',
        tension: 0.25,
        pointRadius: points.length > 45 ? 0 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        spanGaps: false,
      },
    ];
    if (metric === 'visits') {
      datasets.push({
        label: 'Visitors',
        data: points.map((point) => point.visitors),
        borderColor: theme.ramp[2] ?? theme.muted,
        backgroundColor: 'transparent',
        tension: 0.25,
        pointRadius: points.length > 45 ? 0 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      });
    }
    if (previous !== null) {
      datasets.push({
        label: `Previous period${metric === 'visits' ? ' visits' : ''}`,
        data: previous.map((point) => pick(metric, point)),
        borderColor: theme.muted,
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 1.5,
      });
    }
    return { labels, datasets };
  }, [labels, metric, points, previous, theme]);

  const missing = points.flatMap((point, index) => (point.missing ? [index] : []));
  const plugins = useMemo(() => [missingShadePlugin(missing, theme.border.length > 0 ? `${theme.border}66` : 'rgba(0,0,0,0.08)')], [missing, theme.border]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (_event, elements) => {
      const first = elements[0];
      const key = first === undefined ? undefined : points[first.index]?.key;
      if (key !== undefined && onPick !== undefined) {
        onPick(key);
      }
    },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: theme.muted, boxWidth: 12, font: { family: theme.fontFamily, size: 11 } } },
      tooltip: {
        callbacks: {
          title: (items) => {
            const index = items[0]?.dataIndex;
            if (index === undefined) {
              return '';
            }
            const point = points[index];
            const label = labels[index] ?? '';
            const previousPoint = previous?.[index];
            return previousPoint === undefined ? label : `${label} (vs ${formatDayShort(previousPoint.key)})${point?.missing ? ' · no file' : ''}`;
          },
          label: (item) => ` ${item.dataset.label ?? ''}: ${formatValue(metric, item.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.muted, maxTicksLimit: 10, maxRotation: 0, font: { family: theme.fontFamily, size: 11 } } },
      y: {
        beginAtZero: true,
        grid: { color: `${theme.border}` },
        ticks: { color: theme.muted, precision: 0, font: { family: theme.fontFamily, size: 11 }, callback: (value) => formatValue(metric, typeof value === 'number' ? value : Number(value)) },
        ...(metric === 'beacon' ? { max: 100 } : {}),
      },
    },
  };

  const columns = ['Period', ...(metric === 'visits' ? ['Visits', 'Visitors'] : [METRIC_LABELS[metric]]), ...(previous === null ? [] : ['Previous period'])];
  const rows = points.map((point, index) => [
    labels[index] ?? point.key,
    formatValue(metric, pick(metric, point)),
    ...(metric === 'visits' ? [formatNumber(point.visitors)] : []),
    ...(previous === null ? [] : [formatValue(metric, pick(metric, previous[index] ?? ({} as SeriesPoint)))]),
  ]);

  return (
    <>
      <div className="metric-switch" role="group" aria-label="Chart metric">
        {METRICS.map((option) => (
          <button key={option} type="button" aria-pressed={metric === option} onClick={() => setMetric(option)}>
            {METRIC_LABELS[option]}
          </button>
        ))}
      </div>
      <div className="chart-frame is-tall" role="img" aria-label={`${METRIC_LABELS[metric]} per ${weekly ? 'week' : 'day'}`}>
        <Line data={data} options={options} plugins={plugins} />
      </div>
      <TableTwin name={`${METRIC_LABELS[metric]} per ${weekly ? 'week' : 'day'} ${points[0]?.key ?? ''} to ${points[points.length - 1]?.key ?? ''}`} columns={columns} rows={rows} />
    </>
  );
}
