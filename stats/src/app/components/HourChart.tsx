import type { ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useChartTheme } from '../charts/use-chart-theme';
import { formatHour, formatNumber } from '../formatters/format';
import { TableTwin } from './TableTwin';

/** Props of HourChart. */
export interface HourChartProps {
  /** Visit starts per local hour, 24 entries. */
  readonly byHour: readonly number[];
}

/** Visits by hour of the day in the site's time zone, as 24 columns. */
export function HourChart({ byHour }: HourChartProps) {
  const theme = useChartTheme();
  const labels = byHour.map((_, hour) => formatHour(hour));
  const data: ChartData<'bar', number[], string> = {
    labels,
    datasets: [{ label: 'Visits', data: [...byHour], backgroundColor: theme.accent, borderRadius: 2, barPercentage: 0.8, categoryPercentage: 0.9 }],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (item) => ` ${formatNumber(item.parsed.y ?? 0)} visits` } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.muted, maxTicksLimit: 8, maxRotation: 0, font: { family: theme.fontFamily, size: 11 } } },
      y: { beginAtZero: true, grid: { color: theme.border }, ticks: { color: theme.muted, precision: 0, font: { family: theme.fontFamily, size: 11 } } },
    },
  };
  return (
    <>
      <div className="chart-frame is-short" role="figure" aria-label="Visits by hour of the day">
        <Bar data={data} options={options} />
      </div>
      <TableTwin name="Visits by hour" columns={['Hour', 'Visits']} rows={byHour.map((count, hour) => [formatHour(hour), formatNumber(count)])} />
    </>
  );
}
