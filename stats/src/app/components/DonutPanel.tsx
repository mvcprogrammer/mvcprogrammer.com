import type { ChartData, ChartOptions } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { Counts } from '../aggregation/aggregate';
import { useChartTheme } from '../charts/use-chart-theme';
import { formatNumber, formatPercent } from '../formatters/format';
import type { Dimension } from '../query/query';

/** Props of Donut. */
export interface DonutProps {
  readonly title: string;
  readonly counts: Counts;
  readonly dimension: Dimension;
  readonly onSelect: (dimension: Dimension, value: string) => void;
  readonly selected?: string;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** One small doughnut with a legend list whose entries filter. Honest only for two or three categories, which is where it is used. */
export function Donut({ title, counts, dimension, onSelect, selected }: DonutProps) {
  const theme = useChartTheme();
  const entries = Object.entries(counts);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const data: ChartData<'doughnut', number[], string> = {
    labels: entries.map(([label]) => capitalize(label)),
    datasets: [{ data: entries.map(([, count]) => count), backgroundColor: entries.map((_, index) => theme.ramp[index % theme.ramp.length] ?? theme.accent), borderColor: theme.surface, borderWidth: 2 }],
  };
  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (item) => ` ${item.label}: ${formatNumber(item.parsed)} (${formatPercent(total === 0 ? null : item.parsed / total)})` } },
    },
  };
  return (
    <div className="donut">
      <h3 className="sr-only">{title}</h3>
      <div className="chart-frame is-donut" role="figure" aria-label={`${title}: ${entries.map(([label, count]) => `${capitalize(label)} ${formatNumber(count)}`).join(', ')}`}>
        <Doughnut data={data} options={options} />
      </div>
      <ul className="donut-legend" aria-label={title}>
        {entries.map(([label, count], index) => (
          <li key={label}>
            <button type="button" onClick={() => onSelect(dimension, label)} aria-pressed={selected === label} aria-label={`Filter by ${title.toLowerCase()} ${capitalize(label)}`}>
              <span className={`swatch swatch-${(index % 6) + 1}`} aria-hidden="true" />
              {capitalize(label)}
            </button>
            <span className="legend-count">
              {formatNumber(count)} · {formatPercent(total === 0 ? null : count / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
