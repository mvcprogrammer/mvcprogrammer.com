/** Props of Sparkline. */
export interface SparklineProps {
  /** The values, oldest first; an empty or all-zero list draws a flat baseline. */
  readonly values: readonly number[];
  /** What the sparkline shows, for assistive technology. */
  readonly label: string;
}

const WIDTH = 100;
const HEIGHT = 30;
const PAD = 2;

/** The SVG points for a series: x spread across the width, y scaled to the tallest value. */
export function sparklinePoints(values: readonly number[]): string {
  if (values.length === 0) {
    return `0,${HEIGHT - PAD} ${WIDTH},${HEIGHT - PAD}`;
  }
  const max = Math.max(...values, 0);
  const step = values.length === 1 ? 0 : (WIDTH - 2 * PAD) / (values.length - 1);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? WIDTH / 2 : PAD + index * step;
      const y = max === 0 ? HEIGHT - PAD : HEIGHT - PAD - (value / max) * (HEIGHT - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** A small inline SVG trend line. Widths and points are attributes, so it needs no inline style. */
export function Sparkline({ values, label }: SparklineProps) {
  const points = sparklinePoints(values);
  const first = points.split(' ')[0]?.split(',')[0] ?? '0';
  const last = points.split(' ').at(-1)?.split(',')[0] ?? String(WIDTH);
  return (
    <svg className="sparkline" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polygon className="sparkline-fill" points={`${first},${HEIGHT} ${points} ${last},${HEIGHT}`} />
      <polyline points={points} />
    </svg>
  );
}
