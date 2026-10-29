import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { SiteOptions } from './configurations/site-options';
import { provideSite } from './providers/site-providers';

/**
 * What the app talks to and links to. The FHIR API is served by CloudFront on this origin, so the
 * base is relative; the site URL is where the brand and the "about" line point. Validated by
 * provideSite() at startup.
 */
const siteOptions: SiteOptions = {
  fhirApiBase: 'api/fhir',
  siteUrl: 'https://mvcprogrammer.com/',
};

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes), provideSite(siteOptions)],
};
