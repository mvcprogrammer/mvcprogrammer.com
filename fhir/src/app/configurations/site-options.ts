import { InjectionToken } from '@angular/core';

/**
 * What the app talks to and links to. Provided through SITE_OPTIONS by provideSite(), so no
 * component names a URL.
 */
export interface SiteOptions {
  /** Relative base of the FHIR API behind the explorer, served by CloudFront on the same origin. */
  readonly fhirApiBase: string;

  /** The main site, where the brand and the "about" line point. */
  readonly siteUrl: string;
}

/** Injection token for the site options. */
export const SITE_OPTIONS = new InjectionToken<SiteOptions>('SITE_OPTIONS');
