import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import type { SiteOptions } from './app/configurations/site-options';
import { createSiteServices } from './app/providers/site-services';
import './react.css';

/**
 * Endpoints the site talks to. The Blazor edition keeps these in appsettings.json and the Angular
 * edition in app.config.ts; here they are the one place in the code that names a Lambda URL.
 * Validated by createSiteServices() at startup.
 */
const siteOptions: SiteOptions = {
  contactEndpoint: 'https://y4z5rf27yv7aoy4zpuu5twkwl40ijxab.lambda-url.us-east-1.on.aws/',
  experienceApiBase: 'api',
  experienceSeedPath: 'data/positions.json',
  fhirApiBase: 'api/fhir',
  kioskUrl: 'https://display.lightsplitters.com/',
  resumeUrl: 'https://mbm35w76dfwyr3sg45ez5p4oma0aqtta.lambda-url.us-east-1.on.aws/?edition=react',
};

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html has no #root element.');
}

createRoot(root).render(
  <StrictMode>
    <App services={createSiteServices(siteOptions)} />
  </StrictMode>,
);
