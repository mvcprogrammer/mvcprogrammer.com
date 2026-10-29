import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import type { SiteOptions } from '../app/configurations/site-options';
import type { ContactTopicState } from '../app/interfaces/contact-topic-state';
import { SiteProvider } from '../app/providers/SiteProvider';
import type { SiteServices } from '../app/providers/site-services';
import { ListenerContactTopicState } from '../app/services/listener-contact-topic-state';
import { FakeContactClient } from './fake-contact-client';
import { FakeEngagementTracker } from './fake-engagement-tracker';
import { FakeExperienceClient } from './fake-experience-client';

/** The site options every component test runs with. */
export const TEST_SITE_OPTIONS: SiteOptions = {
  contactEndpoint: 'https://contact.example.test/',
  experienceApiBase: 'api',
  experienceSeedPath: 'data/positions.json',
  fhirExplorerUrl: 'https://fhir.example.test/',
  kioskUrl: 'https://kiosk.example.test/',
  resumeUrl: 'https://resume.example.test/',
};

/** The fakes and the real topic state a test renders with through renderWithSite(). */
export interface SiteTestServices extends SiteServices {
  readonly experience: FakeExperienceClient;
  readonly contact: FakeContactClient;
  readonly engagement: FakeEngagementTracker;
  readonly topics: ContactTopicState;
}

/** Builds the test options, the fakes for the two clients and the tracker, and the real topic state. */
export function createSiteTestServices(): SiteTestServices {
  return {
    options: TEST_SITE_OPTIONS,
    experience: new FakeExperienceClient(),
    contact: new FakeContactClient(),
    engagement: new FakeEngagementTracker(),
    topics: new ListenerContactTopicState(),
  };
}

/**
 * Renders an element under a SiteProvider with the given services and a memory router, the way the app does.
 * @param element The component under test.
 * @param services The services to provide; fresh fakes by default.
 * @param path The route the memory router starts at.
 */
export function renderWithSite(
  element: ReactElement,
  services: SiteServices = createSiteTestServices(),
  path = '/',
): RenderResult {
  return render(
    <SiteProvider services={services}>
      <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
    </SiteProvider>,
  );
}

/** The element's text with runs of whitespace collapsed, for assertions on markup spread over lines. */
export function textOf(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** A Response-like object for a fake fetch: the status and the JSON body, or a body that is not JSON. */
export function jsonResponse(
  status: number,
  body: unknown,
  options: { readonly invalidJson?: boolean } = {},
): Response {
  const text =
    options.invalidJson === true ? '<!DOCTYPE html><p>not json</p>' : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'Content-Type': options.invalidJson === true ? 'text/html' : 'application/json' },
  });
}
