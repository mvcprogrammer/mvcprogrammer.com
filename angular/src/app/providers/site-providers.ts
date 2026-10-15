import { provideHttpClient, withFetch } from '@angular/common/http';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { SITE_OPTIONS, SiteOptions } from '../configurations/site-options';
import { ContactClient } from '../interfaces/contact-client';
import { ContactTopicState } from '../interfaces/contact-topic-state';
import { ExperienceClient } from '../interfaces/experience-client';
import { HttpContactClient } from '../services/http-contact-client';
import { HttpExperienceClient } from '../services/http-experience-client';
import { SubjectContactTopicState } from '../services/subject-contact-topic-state';

/**
 * Registers the site's services: the options, HttpClient over fetch, the two clients behind their
 * abstract tokens, and the contact topic state. The Angular counterpart of AddPortfolioServices().
 * @param options Site endpoints. Validated up front so a misconfigured build fails at startup.
 */
export function provideSite(options: SiteOptions): EnvironmentProviders {
  validateSiteOptions(options);

  return makeEnvironmentProviders([
    provideHttpClient(withFetch()),
    { provide: SITE_OPTIONS, useValue: options },
    { provide: ExperienceClient, useClass: HttpExperienceClient },
    { provide: ContactClient, useClass: HttpContactClient },
    { provide: ContactTopicState, useClass: SubjectContactTopicState },
  ]);
}

/**
 * Throws when an option is blank or a URL option is not an absolute URL, naming every problem.
 * @param options The options to check.
 */
export function validateSiteOptions(options: SiteOptions): void {
  const problems: string[] = [];
  const keys: readonly (keyof SiteOptions)[] = ['contactEndpoint', 'experienceApiBase', 'experienceSeedPath', 'kioskUrl', 'resumeUrl'];
  for (const key of keys) {
    if (typeof options[key] !== 'string' || options[key].trim() === '') {
      problems.push(`${key} is required`);
    }
  }

  const urls: readonly (keyof SiteOptions)[] = ['contactEndpoint', 'kioskUrl', 'resumeUrl'];
  for (const key of urls) {
    if (typeof options[key] === 'string' && options[key].trim() !== '' && !URL.canParse(options[key])) {
      problems.push(`${key} must be an absolute URL`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid site options: ${problems.join('; ')}.`);
  }
}
