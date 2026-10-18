import { ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';

// Only the pieces the dashboard draws, so the rest of Chart.js is tree-shaken away: lines, bars,
// doughnuts, the two scales they need, tooltips, legends, and area fills.
Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip);
