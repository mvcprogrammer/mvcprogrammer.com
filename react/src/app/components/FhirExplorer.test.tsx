import { fireEvent, screen, waitFor } from '@testing-library/react';
import { FhirProblemError } from '../exceptions/fhir-problem-error';
import { createSiteTestServices, renderWithSite, type SiteTestServices } from '../../testing/site-testing';
import {
  createCapabilitySubset,
  createEmptyPatientSearchResult,
  createFhirResponse,
  createPatientListItem,
  createPatientSearchResult,
  createPatientSummary,
} from '../../testing/test-data';
import {
  LIST_PROMPT,
  NO_MATCH_MESSAGE,
  SUMMARY_FAILED_MESSAGE,
  SUMMARY_PROMPT,
  SUMMARY_SELECT_PROMPT,
  SUMMARY_UPSTREAM_MESSAGE,
} from '../hooks/use-fhir-explorer';
import { FAMILY_LENGTH_MESSAGE, FAMILY_REQUIRED_MESSAGE } from '../validators/fhir-search-validation';
import { FhirExplorer } from './FhirExplorer';

describe('FhirExplorer', () => {
  let services: SiteTestServices;

  beforeEach(() => {
    services = createSiteTestServices();
  });

  describe('mount', () => {
    it('should check the capability once, log the sandbox, and prefill the example without searching', async () => {
      // Act
      renderWithSite(<FhirExplorer />, services);
      await screen.findByText(/every resource and search parameter/);

      // Assert
      expect(services.fhir.capabilityCalls).toBe(1);
      expect(services.fhir.searches).toEqual([]);
      expect(family().value).toBe('Watsica');
      expect(document.querySelector('[data-fhir-source]')?.textContent).toBe('HAPI sandbox');
      const log = logText();
      expect(log).toContain('→ GET /api/fhir/capability');
      expect(log).toContain('← 200 /capability in 120 ms · X-Cache: Miss from cloudfront · ETag "abc123"');
      expect(log).toContain('HAPI FHIR Server 8.1.0 · FHIR 4.0.1 at https://hapi.fhir.org/baseR4');
      expect(document.getElementById('fhir-list-empty')?.textContent).toBe(LIST_PROMPT);
      expect(document.getElementById('fhir-summary-empty')?.textContent).toBe(SUMMARY_PROMPT);
      expect(rawToggle().disabled).toBe(true);
    });

    it('should name the server and list what is missing when the sandbox lacks something', async () => {
      // Arrange
      services.fhir.onGetCapability = () =>
        Promise.resolve(
          createFhirResponse(
            createCapabilitySubset({
              ok: false,
              baseUrl: 'https://r4.smarthealthit.org',
              software: { name: 'SMART Sandbox' },
              resources: [{ type: 'Encounter', supported: false, searchParams: [{ name: 'patient', supported: false }] }],
            }),
          ),
        );

      // Act
      renderWithSite(<FhirExplorer />, services);
      await screen.findByText(/not supported/);

      // Assert
      expect(document.querySelector('[data-fhir-source]')?.textContent).toBe('SMART Sandbox');
      expect(logText()).toContain('not supported: Encounter, Encounter?patient');
      expect(document.querySelector('.fhir-log-error')).not.toBeNull();
    });

    it('should log a failed capability check and carry on', async () => {
      // Arrange
      services.fhir.onGetCapability = () => Promise.reject(new FhirProblemError('Could not reach the API.', 0, null, 3, null, false));

      // Act
      renderWithSite(<FhirExplorer />, services);
      await screen.findByText(/capability check failed/);

      // Assert
      expect(logText()).toContain('capability check failed: Could not reach the API.');
      expect(document.querySelector('[data-fhir-source]')?.textContent).toBe('HAPI sandbox');
    });
  });

  describe('submit', () => {
    it('should search the prefilled example, list the match, select it, and render the summary', async () => {
      // Arrange
      await mount();

      // Act
      submit();
      await screen.findByText('Watsica258, Kimi714', { selector: '#fhir-card-name' });

      // Assert
      expect(services.fhir.searches).toEqual([{ family: 'Watsica', birthdate: '', identifier: '' }]);
      expect(services.fhir.summaryCalls).toEqual(['78785']);
      expect(status().textContent?.trim()).toBe('1 patient for “Watsica”; the first is selected.');
      expect(status().classList.contains('is-ok')).toBe(true);
      expect(document.getElementById('fhir-count')?.textContent).toBe('(1)');
      const rows = document.querySelectorAll<HTMLButtonElement>('.fhir-patient');
      expect(rows.length).toBe(1);
      expect(rows[0]!.getAttribute('aria-pressed')).toBe('true');
      expect(rows[0]!.querySelector('.fhir-avatar-sm')?.textContent).toBe('KW');
      expect(rows[0]!.querySelector('.fhir-patient-name')?.textContent).toBe('Watsica258, Kimi714');
      expect(rows[0]!.querySelector('.fhir-patient-sub')?.textContent).toBe('born 1963 · female · Patient/78785');
      expect((document.getElementById('fhir-list-empty') as HTMLElement).hidden).toBe(true);
      expect(document.getElementById('fhir-card-meta')?.textContent).toBe('female · 63 years · Patient/78785 · MRN eed8a921');
      expect(document.getElementById('fhir-avatar')?.textContent).toBe('KW');
      expect(document.getElementById('fhir-avatar')?.className).toMatch(/^fhir-avatar fhir-avatar-\d$/);
      expect(document.getElementById('fhir-tile-conditions')?.textContent).toBe('2');
      expect(document.getElementById('fhir-tile-encounters')?.textContent).toBe('31');
      expect(document.getElementById('fhir-tile-observations')?.textContent).toBe('240');
      expect(document.getElementById('fhir-summary')?.getAttribute('aria-busy')).toBe('false');
      expect(rawToggle().disabled).toBe(false);
    });

    it('should render active condition pills with their codes, titles, and the resolved toggle', async () => {
      // Arrange
      await mount();
      submit();
      await screen.findByText('Watsica258, Kimi714', { selector: '#fhir-card-name' });

      // Assert
      const pills = document.querySelectorAll('#fhir-conditions .fhir-pill');
      expect(pills.length).toBe(2);
      expect(pills[0]!.querySelector('.fhir-pill-text')?.textContent).toBe('Essential hypertension (disorder)');
      expect(pills[0]!.querySelector('.fhir-pill-code')?.textContent).toBe('SNOMED CT 59621000');
      expect(pills[0]!.getAttribute('title')).toBe('Onset 2010-05-01 · active');
      const more = pills[1]!.querySelector<HTMLButtonElement>('.fhir-pill-button')!;
      expect(more.textContent).toBe('+1 resolved');
      expect((document.getElementById('fhir-resolved') as HTMLElement).hidden).toBe(true);

      // Act
      fireEvent.click(more);

      // Assert again
      expect(more.textContent).toBe('hide 1 resolved');
      expect(more.getAttribute('aria-expanded')).toBe('true');
      expect((document.getElementById('fhir-resolved') as HTMLElement).hidden).toBe(false);
      expect(document.querySelector('#fhir-resolved .fhir-pill.is-resolved .fhir-pill-text')?.textContent).toBe('Acute bronchitis (disorder)');
    });

    it('should render the vitals table with local times, LOINC codes, and component values', async () => {
      // Arrange
      await mount();

      // Act
      submit();
      await screen.findByText('Watsica258, Kimi714', { selector: '#fhir-card-name' });

      // Assert
      const rows = document.querySelectorAll('#fhir-vitals tbody tr');
      expect(rows.length).toBe(2);
      expect(rows[0]!.querySelector('time')?.getAttribute('dateTime')).toBe('2026-03-31T10:47:00Z');
      expect(rows[0]!.querySelector('.fhir-table-time')).not.toBeNull();
      expect(rows[0]!.querySelector('.fhir-loinc')?.textContent).toBe('85354-9');
      expect(rows[0]!.querySelector('.fhir-table-value')?.textContent).toBe('108/82 mm[Hg]');
      expect(rows[1]!.querySelector('time')?.textContent).toBe('2026-03-31');
      expect(rows[1]!.querySelector('.fhir-table-value')?.textContent).toBe('64.6 kg');
      expect((document.getElementById('fhir-vitals-empty') as HTMLElement).hidden).toBe(true);
    });

    it('should say so when a patient has no conditions or vitals', async () => {
      // Arrange
      await mount();
      services.fhir.onGetSummary = () => Promise.resolve(createFhirResponse(createPatientSummary({ conditions: { active: [], resolved: [] }, vitals: [] })));

      // Act
      submit();
      await screen.findByText('None recorded.');

      // Assert
      expect((document.getElementById('fhir-vitals') as HTMLElement).hidden).toBe(true);
      expect((document.getElementById('fhir-vitals-empty') as HTMLElement).hidden).toBe(false);
    });

    it('should log the request, the response, the upstream trace, and the mapping', async () => {
      // Arrange
      await mount();

      // Act
      submit();
      await screen.findByText('Watsica258, Kimi714', { selector: '#fhir-card-name' });

      // Assert
      const log = logText();
      expect(log).toContain('→ GET /api/fhir/patients?family=Watsica');
      expect(log).toContain('← 200 /patients in 120 ms · X-Cache: Miss from cloudfront · ETag "abc123"');
      expect(log).toContain('↳ GET https://hapi.fhir.org/baseR4/Patient?family=Watsica');
      expect(log).toContain('200 · 110 ms · 1 entry · 1 page');
      expect(log).toContain('1 upstream request in 110 ms wall time · 1 bundle entry · 1 page walked (cap 5 per search)');
      expect(log).toContain('mapped to PatientSearchResult: 1 item');
      expect(log).toContain('→ GET /api/fhir/patients/78785/summary');
      expect(log).toContain('2 upstream requests in 580 ms wall time · 3 bundle entries');
      expect(log).toContain('mapped to PatientSummary: 1 active and 1 resolved conditions, 2 vital signs');
      expect(document.querySelector('#fhir-dto-details summary')?.textContent).toBe('The PatientSummary the function returned');
      expect(document.getElementById('fhir-dto')?.textContent).toContain('"initials": "KW"');
    });

    it('should note a cache hit and show the original request time', async () => {
      // Arrange
      await mount();
      services.fhir.onSearchPatients = () => Promise.resolve(createFhirResponse(createPatientSearchResult(), { xCache: 'Hit from cloudfront' }));

      // Act
      submit();
      await screen.findByText('Watsica258, Kimi714', { selector: '#fhir-card-name' });

      // Assert
      expect(logText()).toContain('served from the CloudFront cache; the upstream numbers below are from the original request at 2026-10-21T15:00:00Z');
    });

    it('should send the birth date and identifier and skip the fallback list for a custom search', async () => {
      // Arrange
      await mount();
      services.fhir.onSearchPatients = () => Promise.resolve(createFhirResponse(createEmptyPatientSearchResult()));

      // Act
      fireEvent.change(family(), { target: { value: 'Nobody' } });
      fireEvent.change(document.getElementById('fhir-birthdate')!, { target: { value: '1979-04-12' } });
      fireEvent.change(document.getElementById('fhir-identifier')!, { target: { value: ' 12345 ' } });
      submit();
      await screen.findByText('No matches.');

      // Assert
      expect(services.fhir.searches).toEqual([{ family: 'Nobody', birthdate: '1979-04-12', identifier: '12345' }]);
      expect(document.getElementById('fhir-count')?.textContent).toBe('(0)');
      expect((document.getElementById('fhir-list-empty') as HTMLElement).hidden).toBe(false);
      expect(document.getElementById('fhir-list-empty')?.textContent).toBe(NO_MATCH_MESSAGE);
      expect(document.getElementById('fhir-summary-empty')?.textContent).toBe(SUMMARY_SELECT_PROMPT);
      expect(services.fhir.summaryCalls).toEqual([]);
    });

    it('should walk the fallback families when the example returns nothing, and stop at the first hit', async () => {
      // Arrange
      await mount();
      services.fhir.onSearchPatients = (request) =>
        Promise.resolve(
          createFhirResponse(
            request.family === 'Meridius'
              ? createPatientSearchResult(createPatientListItem({ id: '9', name: 'Meridius, Max', familyName: 'Meridius', givenName: 'Max' }))
              : createEmptyPatientSearchResult(),
          ),
        );

      // Act
      submit();
      await screen.findByText('Meridius, Max', { selector: '.fhir-patient-name' });

      // Assert
      expect(services.fhir.searches.map((search) => search.family)).toEqual(['Watsica', 'Grant', 'Meridius']);
      expect(family().value).toBe('Meridius');
      expect(logText()).toContain('nothing for "Watsica"; the sandbox may have been wiped, trying "Grant"');
      expect(status().textContent?.trim()).toBe('1 patient for “Meridius”; the first is selected.');
      await waitFor(() => expect(services.fhir.summaryCalls).toEqual(['9']));
    });

    it('should show the total when the sandbox reports more matches than the page', async () => {
      // Arrange
      await mount();
      services.fhir.onSearchPatients = () => Promise.resolve(createFhirResponse({ ...createPatientSearchResult(), total: 42 }));

      // Act
      submit();
      await screen.findByText('(1 of 42)');

      // Assert
      expect(document.getElementById('fhir-count')?.textContent).toBe('(1 of 42)');
    });

    it('should show the problem message and the upstream hint when the search fails at the sandbox', async () => {
      // Arrange
      await mount();
      services.fhir.onSearchPatients = () =>
        Promise.reject(new FhirProblemError(FhirProblemError.UPSTREAM_MESSAGE, 504, 'Gateway Timeout', 22_000, 'Error from cloudfront', false));

      // Act
      submit();
      await screen.findByText(SUMMARY_UPSTREAM_MESSAGE);

      // Assert
      expect(status().textContent?.trim()).toBe(FhirProblemError.UPSTREAM_MESSAGE);
      expect(status().classList.contains('is-error')).toBe(true);
      expect(document.getElementById('fhir-list-empty')?.textContent).toBe(FhirProblemError.UPSTREAM_MESSAGE);
      expect(logText()).toContain('← 504 /patients: Gateway Timeout in 22000 ms · X-Cache: Error from cloudfront');
      expect((document.getElementById('fhir-submit') as HTMLButtonElement).disabled).toBe(false);
      expect(document.getElementById('fhir-search')?.classList.contains('is-loading')).toBe(false);
    });

    it('should show nothing-to-show for any other failure, and a network error line', async () => {
      // Arrange
      await mount();
      services.fhir.onSearchPatients = () => Promise.reject(new FhirProblemError(FhirProblemError.NETWORK_MESSAGE, 0, null, 3, null, false));

      // Act
      submit();
      await screen.findByText(SUMMARY_FAILED_MESSAGE);

      // Assert
      expect(logText()).toContain('← network error');
    });

    it('should require a family name without searching, and clear the message once the field is fixed', async () => {
      // Arrange. A date input drops a malformed value before React sees it, so the birth-date rule is covered by the validator's own test.
      await mount();

      // Act
      fireEvent.change(family(), { target: { value: '   ' } });
      submit();

      // Assert
      expect(services.fhir.searches).toEqual([]);
      expect(document.getElementById('fhir-family-error')?.textContent).toBe(FAMILY_REQUIRED_MESSAGE);
      expect(family().classList.contains('is-invalid')).toBe(true);
      expect(family().getAttribute('aria-invalid')).toBe('true');
      expect(document.getElementById('fhir-birthdate-error')?.textContent).toBe('');

      // Act again
      fireEvent.change(family(), { target: { value: 'Grant' } });

      // Assert again
      expect(document.getElementById('fhir-family-error')?.textContent).toBe('');
      expect(family().classList.contains('is-invalid')).toBe(false);
    });

    it('should cap the family name at sixty characters', async () => {
      // Arrange
      await mount();

      // Act
      fireEvent.change(family(), { target: { value: 'a'.repeat(61) } });
      submit();

      // Assert
      expect(services.fhir.searches).toEqual([]);
      expect(document.getElementById('fhir-family-error')?.textContent).toBe(FAMILY_LENGTH_MESSAGE);
    });
  });

  describe('select', () => {
    it('should load the chosen patient, press its row, and show the summary failure inline', async () => {
      // Arrange
      await mount();
      services.fhir.onSearchPatients = () =>
        Promise.resolve(createFhirResponse(createPatientSearchResult(createPatientListItem(), createPatientListItem({ id: '2', name: 'Watsica, Two', givenName: 'Two' }))));
      submit();
      await screen.findByText('Watsica258, Kimi714', { selector: '#fhir-card-name' });
      services.fhir.onGetSummary = () => Promise.reject(new FhirProblemError('The request failed (404).', 404, 'Not Found', 30, null, false));

      // Act
      fireEvent.click(document.querySelectorAll<HTMLButtonElement>('.fhir-patient')[1]!);
      await screen.findByText('The request failed (404).', { selector: '#fhir-summary-empty' });

      // Assert
      expect(services.fhir.summaryCalls).toEqual(['78785', '2']);
      const rows = document.querySelectorAll<HTMLButtonElement>('.fhir-patient');
      expect(rows[0]!.getAttribute('aria-pressed')).toBe('false');
      expect(rows[1]!.getAttribute('aria-pressed')).toBe('true');
      expect(document.getElementById('fhir-card')).toBeNull();
      expect(rawToggle().disabled).toBe(true);
      expect(logText()).toContain('← 404 /patients/2/summary: Not Found in 30 ms');
    });

    it('should ignore a summary that arrives after another patient was selected', async () => {
      // Arrange
      await mount();
      let resolveFirst: () => void = () => undefined;
      services.fhir.onSearchPatients = () =>
        Promise.resolve(createFhirResponse(createPatientSearchResult(createPatientListItem(), createPatientListItem({ id: '2', name: 'Watsica, Two', givenName: 'Two' }))));
      services.fhir.onGetSummary = (id) =>
        id === '78785'
          ? new Promise((resolve) => {
              resolveFirst = () => resolve(createFhirResponse(createPatientSummary()));
            })
          : Promise.resolve(createFhirResponse(createPatientSummary({ patient: { ...createPatientSummary().patient, id: '2', name: 'Watsica, Two' } })));
      submit();
      await screen.findByText('Watsica, Two', { selector: '.fhir-patient-name' });

      // Act
      fireEvent.click(document.querySelectorAll<HTMLButtonElement>('.fhir-patient')[1]!);
      await screen.findByText('Watsica, Two', { selector: '#fhir-card-name' });
      resolveFirst();
      await new Promise((r) => setTimeout(r, 0));

      // Assert
      expect(document.getElementById('fhir-card-name')?.textContent).toBe('Watsica, Two');
    });
  });

  describe('toggleRaw', () => {
    it('should load the raw bundle once, show it, hide it, and reuse it for the same patient', async () => {
      // Arrange
      await mount();
      submit();
      await screen.findByText('Watsica258, Kimi714', { selector: '#fhir-card-name' });

      // Act
      fireEvent.click(rawToggle());
      await screen.findByText(/"resourceType": "Bundle"/, { selector: '#fhir-raw' });

      // Assert
      expect(services.fhir.rawCalls).toEqual(['78785']);
      expect(rawToggle().getAttribute('aria-expanded')).toBe('true');
      expect(raw().hidden).toBe(false);
      expect(logText()).toContain('→ GET /api/fhir/patients/78785/raw');
      expect(logText()).toContain('← 200 application/fhir+json; charset=utf-8 in 120 ms · X-Cache: Miss from cloudfront · 30 bytes');

      // Act again: hide, then show without another request
      fireEvent.click(rawToggle());
      expect(raw().hidden).toBe(true);
      fireEvent.click(rawToggle());

      // Assert again
      expect(services.fhir.rawCalls).toEqual(['78785']);
      expect(raw().hidden).toBe(false);
    });

    it('should show the failure in the raw panel', async () => {
      // Arrange
      await mount();
      submit();
      await screen.findByText('Watsica258, Kimi714', { selector: '#fhir-card-name' });
      services.fhir.onGetRawBundle = () => Promise.reject(new FhirProblemError(FhirProblemError.UPSTREAM_MESSAGE, 502, 'Bad Gateway', 40, null, false));

      // Act
      fireEvent.click(rawToggle());
      await screen.findByText('The raw bundle could not be loaded (502).');

      // Assert
      expect(raw().textContent).toBe('The raw bundle could not be loaded (502).');
    });

    it('should do nothing before a summary is loaded', async () => {
      // Arrange
      await mount();

      // Act
      fireEvent.click(rawToggle());

      // Assert
      expect(services.fhir.rawCalls).toEqual([]);
      expect(raw().hidden).toBe(true);
    });
  });

  describe('unmount', () => {
    it('should drop a response that arrives after the component is gone', async () => {
      // Arrange
      let resolve: () => void = () => undefined;
      services.fhir.onGetCapability = () =>
        new Promise((r) => {
          resolve = () => r(createFhirResponse(createCapabilitySubset({ software: { name: 'Late Server' } })));
        });
      const { unmount } = renderWithSite(<FhirExplorer />, services);

      // Act
      unmount();
      resolve();
      await new Promise((r) => setTimeout(r, 0));

      // Assert: nothing threw and nothing rendered after unmount
      expect(document.querySelector('[data-fhir-source]')).toBeNull();
    });
  });

  async function mount(): Promise<void> {
    renderWithSite(<FhirExplorer />, services);
    await screen.findByText(/every resource and search parameter/);
  }

  function submit(): void {
    fireEvent.submit(document.getElementById('fhir-search')!);
  }

  function family(): HTMLInputElement {
    return document.getElementById('fhir-family') as HTMLInputElement;
  }

  function status(): HTMLElement {
    return document.getElementById('fhir-status') as HTMLElement;
  }

  function rawToggle(): HTMLButtonElement {
    return document.getElementById('fhir-raw-toggle') as HTMLButtonElement;
  }

  function raw(): HTMLElement {
    return document.getElementById('fhir-raw') as HTMLElement;
  }

  function logText(): string {
    return document.getElementById('fhir-log')?.textContent ?? '';
  }
});
