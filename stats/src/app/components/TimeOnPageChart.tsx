import type { ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { TIME_BUCKET_LABELS, bucketSeconds, quantile } from '../aggregation/aggregate';
import { useChartTheme } from '../charts/use-chart-theme';
import { formatDuration, formatNumber } from '../formatters/format';
import { TableTwin } from './TableTwin';

/** Props of TimeOnPageChart. */
export interface TimeOnPageChartProps {
  /** Seconds visible, one per visit that reported it, sorted. */
  readonly seconds: readonly number[];
}

/** A histogram of time on page over the six fixed buckets, with the median and 75th percentile. */
export function TimeOnPageChart({ seconds }: TimeOnPageChartProps) {
  const theme = useChartTheme();
  const buckets = bucketSeconds(seconds);
  const data: ChartData<'bar', number[], string> = {
    labels: [...TIME_BUCKET_LABELS],
    datasets: [{ label: 'Visits', data: buckets, backgroundColor: theme.ramp[2] ?? theme.accent, borderRadius: 3, barPercentage: 0.85 }],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (item) => ` ${formatNumber(item.parsed.y ?? 0)} visits` } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.muted, maxRotation: 0, font: { family: theme.fontFamily, size: 11 } } },
      y: { beginAtZero: true, grid: { color: theme.border }, ticks: { color: theme.muted, precision: 0, font: { family: theme.fontFamily, size: 11 } } },
    },
  };
  return (
    <>
      <p className="panel-note">
        Median {formatDuration(quantile(seconds, 0.5))} · 75th percentile {formatDuration(quantile(seconds, 0.75))} · {formatNumber(seconds.length)} visits reported it
      </p>
      <div className="chart-frame is-short" role="figure" aria-label="Time on page histogram">
        <Bar data={data} options={options} />
      </div>
      <TableTwin name="Time on page" columns={['Seconds visible', 'Visits']} rows={buckets.map((count, index) => [TIME_BUCKET_LABELS[index] ?? '', formatNumber(count)])} />
    </>
  );
}
