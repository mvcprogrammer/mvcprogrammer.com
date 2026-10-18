import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/charts/register';
import { createFetchStatsClient } from './app/data/stats-client';
import './stats.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html has no #root element.');
}

// The day files live under data/ next to the page: public/data/ on the dev server (written by
// `npm run data`), and the stats/data/ prefix of the bucket in production (written by the workflow).
createRoot(root).render(
  <StrictMode>
    <App client={createFetchStatsClient(`${import.meta.env.BASE_URL}data`)} />
  </StrictMode>,
);
