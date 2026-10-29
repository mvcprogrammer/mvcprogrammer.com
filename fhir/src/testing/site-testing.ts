import { Provider } from '@angular/core';
import { SITE_OPTIONS, SiteOptions } from '../app/configurations/site-options';
import { DemoSession } from '../app/interfaces/demo-session';
import { EngagementTracker } from '../app/interfaces/engagement-tracker';
import { FhirClient } from '../app/interfaces/fhir-client';
import { FakeDemoSession } from './fake-demo-session';
import { FakeEngagementTracker } from './fake-engagement-tracker';
import { FakeFhirClient } from './fake-fhir-client';

/** The site options every component test runs with. */
export const TEST_SITE_OPTIONS: SiteOptions = {
  fhirApiBase: 'api/fhir',
  siteUrl: 'https://site.example.test/',
};

/** The fakes a test registers through createSiteTestServices(). */
export interface SiteTestServices {
  readonly fhir: FakeFhirClient;
  readonly session: FakeDemoSession;
  readonly engagement: FakeEngagementTracker;
  readonly providers: Provider[];
}

/** Builds the test options and the fakes for the FHIR client, the session, and the tracker, with their providers. */
export function createSiteTestServices(): SiteTestServices {
  const fhir = new FakeFhirClient();
  const session = new FakeDemoSession();
  const engagement = new FakeEngagementTracker();
  return {
    fhir,
    session,
    engagement,
    providers: [
      { provide: SITE_OPTIONS, useValue: TEST_SITE_OPTIONS },
      { provide: DemoSession, useValue: session },
      { provide: FhirClient, useValue: fhir },
      { provide: EngagementTracker, useValue: engagement },
    ],
  };
}

/** Sets an input's value the way a visitor typing would, so the reactive form hears about it. */
export function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The element's text with runs of whitespace collapsed, for assertions on markup spread over lines. */
export function textOf(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}
