import { Provider } from '@angular/core';
import { SITE_OPTIONS, SiteOptions } from '../app/configurations/site-options';
import { ContactClient } from '../app/interfaces/contact-client';
import { ContactTopicState } from '../app/interfaces/contact-topic-state';
import { ExperienceClient } from '../app/interfaces/experience-client';
import { SubjectContactTopicState } from '../app/services/subject-contact-topic-state';
import { FakeContactClient } from './fake-contact-client';
import { FakeExperienceClient } from './fake-experience-client';

/** The site options every component test runs with. */
export const TEST_SITE_OPTIONS: SiteOptions = {
  contactEndpoint: 'https://contact.example.test/',
  experienceApiBase: 'api',
  experienceSeedPath: 'data/positions.json',
  kioskUrl: 'https://kiosk.example.test/',
  resumeUrl: 'https://resume.example.test/',
};

/** The fakes and the real topic state a test registers through provideSiteTesting(). */
export interface SiteTestServices {
  readonly experience: FakeExperienceClient;
  readonly contact: FakeContactClient;
  readonly topics: ContactTopicState;
  readonly providers: Provider[];
}

/** Builds the test options, the fakes for the two clients, and the real topic state, with their providers. */
export function createSiteTestServices(): SiteTestServices {
  const experience = new FakeExperienceClient();
  const contact = new FakeContactClient();
  const topics = new SubjectContactTopicState();
  return {
    experience,
    contact,
    topics,
    providers: [
      { provide: SITE_OPTIONS, useValue: TEST_SITE_OPTIONS },
      { provide: ExperienceClient, useValue: experience },
      { provide: ContactClient, useValue: contact },
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
