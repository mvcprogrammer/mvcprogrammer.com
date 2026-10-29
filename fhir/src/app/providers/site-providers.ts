import { provideHttpClient, withFetch } from '@angular/common/http';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { SITE_OPTIONS, SiteOptions } from '../configurations/site-options';
import { EngagementTracker } from '../interfaces/engagement-tracker';
import { FhirClient } from '../interfaces/fhir-client';
import { BeaconEngagementTracker } from '../services/beacon-engagement-tracker';
import { HttpFhirClient } from '../services/http-fhir-client';

/**
 * Registers the app's services: the options, HttpClient over fetch, the FHIR client behind its
 * abstract token, and the engagement tracker. The Angular counterpart of AddPortfolioServices().
 * @param options Site endpoints. Validated up front so a misconfigured build fails at startup.
 */
export function provideSite(options: SiteOptions): EnvironmentProviders {
  validateSiteOptions(options);

  return makeEnvironmentProviders([
    provideHttpClient(withFetch()),
    { provide: SITE_OPTIONS, useValue: options },
    { provide: FhirClient, useClass: HttpFhirClient },
    { provide: EngagementTracker, useClass: BeaconEngagementTracker },
  ]);
}

/**
 * Throws when an option is blank or the site URL is not an absolute URL, naming every problem.
 * @param options The options to check.
 */
export function validateSiteOptions(options: SiteOptions): void {
  const problems: string[] = [];
  const keys: readonly (keyof SiteOptions)[] = ['fhirApiBase', 'siteUrl'];
  for (const key of keys) {
    if (typeof options[key] !== 'string' || options[key].trim() === '') {
      problems.push(`${key} is required`);
    }
  }

  if (typeof options.siteUrl === 'string' && options.siteUrl.trim() !== '' && !URL.canParse(options.siteUrl)) {
    problems.push('siteUrl must be an absolute URL');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid site options: ${problems.join('; ')}.`);
  }
}
