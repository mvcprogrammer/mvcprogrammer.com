import type { SiteOptions } from '../configurations/site-options';
import type { ContactClient } from '../interfaces/contact-client';
import type { ContactTopicState } from '../interfaces/contact-topic-state';
import type { EngagementTracker } from '../interfaces/engagement-tracker';
import type { ExperienceClient } from '../interfaces/experience-client';
import { BeaconEngagementTracker } from '../services/beacon-engagement-tracker';
import { FetchContactClient } from '../services/fetch-contact-client';
import { FetchExperienceClient } from '../services/fetch-experience-client';
import { ListenerContactTopicState } from '../services/listener-contact-topic-state';

/** Everything the components depend on, supplied once at the root by SiteProvider. */
export interface SiteServices {
  /** The endpoints. */
  readonly options: SiteOptions;

  /** The Experience API client. */
  readonly experience: ExperienceClient;

  /** The contact Lambda client. */
  readonly contact: ContactClient;

  /** The topic hand-off between the call-to-action buttons and the contact form. */
  readonly topics: ContactTopicState;

  /** The engagement beacon. */
  readonly engagement: EngagementTracker;
}

/**
 * Builds the site's services: the options, the two fetch clients, the topic state, and the beacon.
 * The React counterpart of AddPortfolioServices() and provideSite().
 * @param options Site endpoints. Validated up front so a misconfigured build fails at startup.
 */
export function createSiteServices(options: SiteOptions): SiteServices {
  validateSiteOptions(options);

  return {
    options,
    experience: new FetchExperienceClient(options),
    contact: new FetchContactClient(options),
    topics: new ListenerContactTopicState(),
    engagement: new BeaconEngagementTracker(),
  };
}

/**
 * Throws when an option is blank or a URL option is not an absolute URL, naming every problem.
 * @param options The options to check.
 */
export function validateSiteOptions(options: SiteOptions): void {
  const problems: string[] = [];
  const keys: readonly (keyof SiteOptions)[] = [
    'contactEndpoint',
    'experienceApiBase',
    'experienceSeedPath',
    'fhirExplorerUrl',
    'kioskUrl',
    'resumeUrl',
  ];
  for (const key of keys) {
    if (typeof options[key] !== 'string' || options[key].trim() === '') {
      problems.push(`${key} is required`);
    }
  }

  const urls: readonly (keyof SiteOptions)[] = [
    'contactEndpoint',
    'fhirExplorerUrl',
    'kioskUrl',
    'resumeUrl',
  ];
  for (const key of urls) {
    if (
      typeof options[key] === 'string' &&
      options[key].trim() !== '' &&
      !URL.canParse(options[key])
    ) {
      problems.push(`${key} must be an absolute URL`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid site options: ${problems.join('; ')}.`);
  }
}
