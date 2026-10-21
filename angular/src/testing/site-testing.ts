import { Provider } from '@angular/core';
import { SITE_OPTIONS, SiteOptions } from '../app/configurations/site-options';
import { ContactClient } from '../app/interfaces/contact-client';
import { ContactTopicState } from '../app/interfaces/contact-topic-state';
import { EngagementTracker } from '../app/interfaces/engagement-tracker';
import { ExperienceClient } from '../app/interfaces/experience-client';
import { FhirClient } from '../app/interfaces/fhir-client';
import { SubjectContactTopicState } from '../app/services/subject-contact-topic-state';
import { FakeContactClient } from './fake-contact-client';
import { FakeEngagementTracker } from './fake-engagement-tracker';
import { FakeExperienceClient } from './fake-experience-client';
import { FakeFhirClient } from './fake-fhir-client';

/** The site options every component test runs with. */
export const TEST_SITE_OPTIONS: SiteOptions = {
  contactEndpoint: 'https://contact.example.test/',
  experienceApiBase: 'api',
  experienceSeedPath: 'data/positions.json',
  fhirApiBase: 'api/fhir',
  kioskUrl: 'https://kiosk.example.test/',
  resumeUrl: 'https://resume.example.test/',
};

/** The fakes and the real topic state a test registers through createSiteTestServices(). */
export interface SiteTestServices {
  readonly experience: FakeExperienceClient;
  readonly fhir: FakeFhirClient;
  readonly contact: FakeContactClient;
  readonly engagement: FakeEngagementTracker;
  readonly topics: ContactTopicState;
  readonly providers: Provider[];
}

/** Builds the test options, the fakes for the three clients and the tracker, and the real topic state, with their providers. */
export function createSiteTestServices(): SiteTestServices {
  const experience = new FakeExperienceClient();
  const fhir = new FakeFhirClient();
  const contact = new FakeContactClient();
  const engagement = new FakeEngagementTracker();
  const topics = new SubjectContactTopicState();
  return {
    experience,
    fhir,
    contact,
    engagement,
    topics,
    providers: [
      { provide: SITE_OPTIONS, useValue: TEST_SITE_OPTIONS },
      { provide: ExperienceClient, useValue: experience },
      { provide: FhirClient, useValue: fhir },
      { provide: ContactClient, useValue: contact },
      { provide: EngagementTracker, useValue: engagement },
      { provide: ContactTopicState, useValue: topics },
    ],
  };
}

/** Sets an input's value the way a visitor typing would, so the reactive form hears about it. */
export function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Picks an option the way a visitor would. */
export function choose(element: HTMLSelectElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/** The element's text with runs of whitespace collapsed, for assertions on markup spread over lines. */
export function textOf(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}
