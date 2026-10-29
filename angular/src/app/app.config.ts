import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { SiteOptions } from './configurations/site-options';
import { provideSite } from './providers/site-providers';

/**
 * Endpoints the site talks to and the demos it frames. The Blazor edition keeps these in appsettings.json; here they are
 * the one place in the code that names a Lambda URL. Validated by provideSite() at startup.
 */
const siteOptions: SiteOptions = {
  contactEndpoint: 'https://y4z5rf27yv7aoy4zpuu5twkwl40ijxab.lambda-url.us-east-1.on.aws/',
  experienceApiBase: 'api',
  experienceSeedPath: 'data/positions.json',
  fhirExplorerUrl: 'https://fhir.mvcprogrammer.com/',
  kioskUrl: 'https://display.lightsplitters.com/',
  resumeUrl: 'https://mbm35w76dfwyr3sg45ez5p4oma0aqtta.lambda-url.us-east-1.on.aws/?edition=angular',
};

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes), provideSite(siteOptions)],
};
