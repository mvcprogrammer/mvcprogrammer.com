import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FhirProblemError } from '../../exceptions/fhir-problem-error';
import { FhirExplorer } from './fhir-explorer';
import { createSiteTestServices, textOf, type } from '../../../testing/site-testing';
import { FakeFhirClient } from '../../../testing/fake-fhir-client';
import {
  createCapabilitySubset,
  createEmptyPatientSearchResult,
  createFhirResponse,
  createPatientListItem,
  createPatientSearchResult,
  createPatientSummary,
} from '../../../testing/test-data';

describe('FhirExplorer', () => {
  let client: FakeFhirClient;
  let fixture: ComponentFixture<FhirExplorer>;
  let host: HTMLElement;

  beforeEach(async () => {
    const services = createSiteTestServices();
    client = services.fhir;
    await TestBed.configureTestingModule({ imports: [FhirExplorer], providers: services.providers }).compileComponents();
  });

  describe('ngOnInit', () => {
    it('should check the capability once, log the sandbox, and prefill the example without searching', async () => {
      // Act
      await render();

      // Assert
      expect(client.capabilityCalls).toBe(1);
      expect(client.searches).toEqual([]);
      expect(family().value).toBe('Programmer');
      expect(host.querySelector('[data-fhir-source]')?.textContent).toBe('HAPI sandbox');
      const log = logText();
      expect(log).toContain('→ GET /api/fhir/capability');
      expect(log).toContain('← 200 /capability in 120 ms · X-Cache: Miss from cloudfront · ETag "abc123"');
      expect(log).toContain('HAPI FHIR Server 8.1.0 · FHIR 4.0.1 at https://hapi.fhir.org/baseR4');
      expect(log).toContain('every resource and search parameter the explorer needs is supported ✓');
      expect(host.querySelector('#fhir-list-empty')?.textContent).toBe(FhirExplorer.LIST_PROMPT);
      expect(host.querySelector('#fhir-summary-empty')?.textContent).toBe(FhirExplorer.SUMMARY_PROMPT);
      expect(rawToggle().disabled).toBe(true);
    });

    it('should name the server and list what is missing when the sandbox lacks something', async () => {
      // Arrange
      client.onGetCapability = () =>
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
      await render();

      // Assert
      expect(host.querySelector('[data-fhir-source]')?.textContent).toBe('SMART Sandbox');
      expect(logText()).toContain('not supported: Encounter, Encounter?patient');
      expect(host.querySelector('.fhir-log-error')).not.toBeNull();
    });

    it('should log a failed capability check and carry on', async () => {
      // Arrange
      client.onGetCapability = () => Promise.reject(new FhirProblemError('Could not reach the API.', 0, null, 3, null, false));

      // Act
      await render();

      // Assert
      expect(logText()).toContain('capability check failed: Could not reach the API.');
      expect(host.querySelector('[data-fhir-source]')?.textContent).toBe('HAPI sandbox');
    });
  });

  describe('submit', () => {
    it('should search the prefilled example, list the match, select it, and render the summary', async () => {
      // Arrange
      await render();

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      expect(client.searches).toEqual([{ family: 'Programmer', birthdate: '', identifier: '' }]);
      expect(client.summaryCalls).toEqual(['78785']);
      expect(status().textContent?.trim()).toBe('1 patient for “Programmer”; the first is selected.');
      expect(status().classList.contains('is-ok')).toBe(true);
      expect(host.querySelector('#fhir-count')?.textContent).toBe('(1)');
      const rows = host.querySelectorAll<HTMLButtonElement>('.fhir-patient');
      expect(rows.length).toBe(1);
      expect(rows[0].getAttribute('aria-pressed')).toBe('true');
      expect(rows[0].querySelector('.fhir-avatar-sm')?.textContent).toBe('KW');
      expect(rows[0].querySelector('.fhir-patient-name')?.textContent).toBe('Watsica258, Kimi714');
      expect(rows[0].querySelector('.fhir-patient-sub')?.textContent).toBe('born 1963 · female · Patient/78785');
      expect(host.querySelector<HTMLElement>('#fhir-list-empty')?.hidden).toBe(true);
      expect(host.querySelector('#fhir-card-name')?.textContent).toBe('Watsica258, Kimi714');
      expect(textOf(host.querySelector('#fhir-card-meta'))).toBe('female · 63 years · Patient/78785 · MRN eed8a921');
      expect(host.querySelector('#fhir-avatar')?.textContent).toBe('KW');
      expect(host.querySelector('#fhir-avatar')?.className).toMatch(/^fhir-avatar fhir-avatar-\d$/);
      expect(host.querySelector('#fhir-tile-conditions')?.textContent).toBe('2');
      expect(host.querySelector('#fhir-tile-encounters')?.textContent).toBe('31');
      expect(host.querySelector('#fhir-tile-observations')?.textContent).toBe('240');
      expect(host.querySelector('#fhir-summary')?.getAttribute('aria-busy')).toBe('false');
      expect(rawToggle().disabled).toBe(false);
    });

    it('should render active condition pills with their codes, titles, and the resolved toggle', async () => {
      // Arrange
      await render();

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      const pills = host.querySelectorAll('#fhir-conditions .fhir-pill');
      expect(pills.length).toBe(2);
      expect(pills[0].querySelector('.fhir-pill-text')?.textContent).toBe('Essential hypertension (disorder)');
      expect(pills[0].querySelector('.fhir-pill-code')?.textContent).toBe('SNOMED CT 59621000');
      expect(pills[0].getAttribute('title')).toBe('Onset 2010-05-01 · active');
      const more = pills[1].querySelector<HTMLButtonElement>('.fhir-pill-button');
      expect(more?.textContent).toBe('+1 resolved');
      expect(host.querySelector<HTMLElement>('#fhir-resolved')?.hidden).toBe(true);

      // Act again
      more?.click();
      await fixture.whenStable();

      // Assert again
      expect(more?.textContent).toBe('hide 1 resolved');
      expect(more?.getAttribute('aria-expanded')).toBe('true');
      expect(host.querySelector<HTMLElement>('#fhir-resolved')?.hidden).toBe(false);
      expect(host.querySelector('#fhir-resolved .fhir-pill.is-resolved .fhir-pill-text')?.textContent).toBe('Acute bronchitis (disorder)');
    });

    it('should render the vitals table with local times, LOINC codes, and component values', async () => {
      // Arrange
      await render();

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      const rows = host.querySelectorAll('#fhir-vitals tbody tr');
      expect(rows.length).toBe(2);
      expect(rows[0].querySelector('time')?.getAttribute('datetime')).toBe('2026-03-31T10:47:00Z');
      expect(rows[0].querySelector('.fhir-table-time')).not.toBeNull();
      expect(rows[0].querySelector('.fhir-loinc')?.textContent).toBe('85354-9');
      expect(rows[0].querySelector('.fhir-table-value')?.textContent).toBe('108/82 mm[Hg]');
      expect(rows[1].querySelector('time')?.textContent).toBe('2026-03-31');
      expect(rows[1].querySelector('.fhir-table-value')?.textContent).toBe('64.6 kg');
      expect(host.querySelector<HTMLElement>('#fhir-vitals-empty')?.hidden).toBe(true);
    });

    it('should say so when a patient has no conditions or vitals', async () => {
      // Arrange
      await render();
      client.onGetSummary = () => Promise.resolve(createFhirResponse(createPatientSummary({ conditions: { active: [], resolved: [] }, vitals: [] })));

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      expect(host.querySelector('#fhir-conditions .fhir-empty-inline')?.textContent).toBe('None recorded.');
      expect(host.querySelector<HTMLElement>('#fhir-vitals')?.hidden).toBe(true);
      expect(host.querySelector<HTMLElement>('#fhir-vitals-empty')?.hidden).toBe(false);
    });

    it('should log the request, the response, the upstream trace, and the mapping', async () => {
      // Arrange
      await render();

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      const log = logText();
      expect(log).toContain('→ GET /api/fhir/patients?family=Programmer');
      expect(log).toContain('← 200 /patients in 120 ms · X-Cache: Miss from cloudfront · ETag "abc123"');
      expect(log).toContain('↳ GET https://hapi.fhir.org/baseR4/Patient?family=Programmer');
      expect(log).toContain('200 · 110 ms · 1 entry · 1 page');
      expect(log).toContain('1 upstream request in 110 ms wall time · 1 bundle entry · 1 page walked (cap 5 per search)');
      expect(log).toContain('mapped to PatientSearchResult: 1 item');
      expect(log).toContain('→ GET /api/fhir/patients/78785/summary');
      expect(log).toContain('2 upstream requests in 580 ms wall time · 3 bundle entries');
      expect(log).toContain('mapped to PatientSummary: 1 active and 1 resolved conditions, 2 vital signs');
      expect(host.querySelector('#fhir-dto-details summary')?.textContent).toBe('The PatientSummary the function returned');
      expect(host.querySelector('#fhir-dto')?.textContent).toContain('"initials": "KW"');
    });

    it('should note a cache hit and show the original request time', async () => {
      // Arrange
      await render();
      client.onSearchPatients = () => Promise.resolve(createFhirResponse(createPatientSearchResult(), { xCache: 'Hit from cloudfront' }));

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      expect(logText()).toContain('served from the CloudFront cache; the upstream numbers below are from the original request at 2026-10-21T15:00:00Z');
    });

    it('should send the birth date and identifier and skip the fallback list for a custom search', async () => {
      // Arrange
      await render();
      client.onSearchPatients = () => Promise.resolve(createFhirResponse(createEmptyPatientSearchResult()));

      // Act
      type(family(), 'Nobody');
      type(host.querySelector<HTMLInputElement>('#fhir-birthdate') as HTMLInputElement, '1979-04-12');
      type(host.querySelector<HTMLInputElement>('#fhir-identifier') as HTMLInputElement, ' 12345 ');
      submit();
      await fixture.whenStable();

      // Assert
      expect(client.searches).toEqual([{ family: 'Nobody', birthdate: '1979-04-12', identifier: '12345' }]);
      expect(status().textContent?.trim()).toBe('No matches.');
      expect(host.querySelector('#fhir-count')?.textContent).toBe('(0)');
      expect(host.querySelector<HTMLElement>('#fhir-list-empty')?.hidden).toBe(false);
      expect(host.querySelector('#fhir-list-empty')?.textContent).toBe(FhirExplorer.NO_MATCH_MESSAGE);
      expect(host.querySelector('#fhir-summary-empty')?.textContent).toBe(FhirExplorer.SUMMARY_SELECT_PROMPT);
      expect(client.summaryCalls).toEqual([]);
    });

    it('should walk the fallback families when the example returns nothing, and stop at the first hit', async () => {
      // Arrange
      await render();
      client.onSearchPatients = (request) =>
        Promise.resolve(createFhirResponse(request.family === 'Meridius' ? createPatientSearchResult(createPatientListItem({ id: '9', name: 'Meridius, Max', familyName: 'Meridius', givenName: 'Max' })) : createEmptyPatientSearchResult()));

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      expect(client.searches.map((search) => search.family)).toEqual(['Programmer', 'Grant', 'Meridius']);
      expect(family().value).toBe('Meridius');
      expect(logText()).toContain('nothing for "Programmer"; the sandbox may have been wiped, trying "Grant"');
      expect(status().textContent?.trim()).toBe('1 patient for “Meridius”; the first is selected.');
      expect(client.summaryCalls).toEqual(['9']);
    });

    it('should show the total when the sandbox reports more matches than the page', async () => {
      // Arrange
      await render();
      client.onSearchPatients = () => Promise.resolve(createFhirResponse({ ...createPatientSearchResult(), total: 42 }));

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      expect(host.querySelector('#fhir-count')?.textContent).toBe('(1 of 42)');
    });

    it('should show the problem message and the upstream hint when the search fails at the sandbox', async () => {
      // Arrange
      await render();
      client.onSearchPatients = () => Promise.reject(new FhirProblemError(FhirProblemError.UPSTREAM_MESSAGE, 504, 'Gateway Timeout', 22_000, 'Error from cloudfront', false));

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      expect(status().textContent?.trim()).toBe(FhirProblemError.UPSTREAM_MESSAGE);
      expect(status().classList.contains('is-error')).toBe(true);
      expect(host.querySelector('#fhir-list-empty')?.textContent).toBe(FhirProblemError.UPSTREAM_MESSAGE);
      expect(host.querySelector('#fhir-summary-empty')?.textContent).toBe(FhirExplorer.SUMMARY_UPSTREAM_MESSAGE);
      expect(logText()).toContain('← 504 /patients: Gateway Timeout in 22000 ms · X-Cache: Error from cloudfront');
      expect(host.querySelector('#fhir-submit')?.hasAttribute('disabled')).toBe(false);
      expect(host.querySelector('#fhir-search')?.classList.contains('is-loading')).toBe(false);
    });

    it('should show nothing-to-show for any other failure, and a network error line', async () => {
      // Arrange
      await render();
      client.onSearchPatients = () => Promise.reject(new FhirProblemError(FhirProblemError.NETWORK_MESSAGE, 0, null, 3, null, false));

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      expect(host.querySelector('#fhir-summary-empty')?.textContent).toBe(FhirExplorer.SUMMARY_FAILED_MESSAGE);
      expect(logText()).toContain('← network error');
    });

    it('should require a family name and reject a malformed birth date without searching', async () => {
      // Arrange
      await render();

      // Act. A date input drops a malformed value before the form sees it, so the control is set directly.
      type(family(), '   ');
      fixture.componentInstance['form'].controls.birthdate.setValue('1979-4-1');
      submit();
      await fixture.whenStable();

      // Assert
      expect(client.searches).toEqual([]);
      expect(host.querySelector('#fhir-family-error')?.textContent).toBe(FhirExplorer.FAMILY_REQUIRED_MESSAGE);
      expect(family().classList.contains('is-invalid')).toBe(true);
      expect(family().getAttribute('aria-invalid')).toBe('true');
      expect(host.querySelector('#fhir-birthdate-error')?.textContent).toBe(FhirExplorer.BIRTHDATE_FORMAT_MESSAGE);

      // Act again: fixing the field clears its message on input
      type(family(), 'Grant');
      await fixture.whenStable();

      // Assert again
      expect(host.querySelector('#fhir-family-error')?.textContent).toBe('');
      expect(family().classList.contains('is-invalid')).toBe(false);
    });

    it('should cap the family name at sixty characters', async () => {
      // Arrange
      await render();

      // Act
      type(family(), 'a'.repeat(61));
      submit();
      await fixture.whenStable();

      // Assert
      expect(client.searches).toEqual([]);
      expect(host.querySelector('#fhir-family-error')?.textContent).toBe(FhirExplorer.FAMILY_LENGTH_MESSAGE);
    });
  });

  describe('select', () => {
    it('should load the chosen patient, press its row, and show the summary failure inline', async () => {
      // Arrange
      await render();
      client.onSearchPatients = () =>
        Promise.resolve(createFhirResponse(createPatientSearchResult(createPatientListItem(), createPatientListItem({ id: '2', name: 'Programmer, Two', givenName: 'Two' }))));
      submit();
      await fixture.whenStable();
      client.onGetSummary = () => Promise.reject(new FhirProblemError('The request failed (404).', 404, 'Not Found', 30, null, false));

      // Act
      host.querySelectorAll<HTMLButtonElement>('.fhir-patient')[1].click();
      await fixture.whenStable();

      // Assert
      expect(client.summaryCalls).toEqual(['78785', '2']);
      const rows = host.querySelectorAll<HTMLButtonElement>('.fhir-patient');
      expect(rows[0].getAttribute('aria-pressed')).toBe('false');
      expect(rows[1].getAttribute('aria-pressed')).toBe('true');
      expect(host.querySelector('#fhir-card')).toBeNull();
      expect(host.querySelector('#fhir-summary-empty')?.textContent).toBe('The request failed (404).');
      expect(rawToggle().disabled).toBe(true);
      expect(logText()).toContain('← 404 /patients/2/summary: Not Found in 30 ms');
    });

    it('should ignore a summary that arrives after another patient was selected', async () => {
      // Arrange
      await render();
      let resolveFirst: () => void = () => undefined;
      client.onSearchPatients = () =>
        Promise.resolve(createFhirResponse(createPatientSearchResult(createPatientListItem(), createPatientListItem({ id: '2', name: 'Programmer, Two', givenName: 'Two' }))));
      client.onGetSummary = (id) =>
        id === '78785'
          ? new Promise((resolve) => {
              resolveFirst = () => resolve(createFhirResponse(createPatientSummary()));
            })
          : Promise.resolve(createFhirResponse(createPatientSummary({ patient: { ...createPatientSummary().patient, id: '2', name: 'Programmer, Two' } })));
      submit();
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();

      // Act
      host.querySelectorAll<HTMLButtonElement>('.fhir-patient')[1].click();
      await new Promise((r) => setTimeout(r, 0));
      resolveFirst();
      await fixture.whenStable();

      // Assert
      expect(host.querySelector('#fhir-card-name')?.textContent).toBe('Programmer, Two');
    });
  });

  describe('toggleRaw', () => {
    it('should load the raw bundle once, show it, hide it, and reuse it for the same patient', async () => {
      // Arrange
      await render();
      submit();
      await fixture.whenStable();

      // Act
      rawToggle().click();
      await fixture.whenStable();

      // Assert
      expect(client.rawCalls).toEqual(['78785']);
      expect(rawToggle().getAttribute('aria-expanded')).toBe('true');
      expect(raw().hidden).toBe(false);
      expect(raw().textContent).toContain('"resourceType": "Bundle"');
      expect(logText()).toContain('→ GET /api/fhir/patients/78785/raw');
      expect(logText()).toContain('← 200 application/fhir+json; charset=utf-8 in 120 ms · X-Cache: Miss from cloudfront · 30 bytes');

      // Act again: hide, then show without another request
      rawToggle().click();
      await fixture.whenStable();
      expect(raw().hidden).toBe(true);
      rawToggle().click();
      await fixture.whenStable();

      // Assert again
      expect(client.rawCalls).toEqual(['78785']);
      expect(raw().hidden).toBe(false);
    });

    it('should show the failure in the raw panel', async () => {
      // Arrange
      await render();
      submit();
      await fixture.whenStable();
      client.onGetRawBundle = () => Promise.reject(new FhirProblemError(FhirProblemError.UPSTREAM_MESSAGE, 502, 'Bad Gateway', 40, null, false));

      // Act
      rawToggle().click();
      await fixture.whenStable();

      // Assert
      expect(raw().textContent).toBe('The raw bundle could not be loaded (502).');
    });

    it('should do nothing before a summary is loaded', async () => {
      // Arrange
      await render();

      // Act
      rawToggle().click();
      await fixture.whenStable();

      // Assert
      expect(client.rawCalls).toEqual([]);
      expect(raw().hidden).toBe(true);
    });
  });

  describe('ngOnDestroy', () => {
    it('should drop a response that arrives after the component is destroyed', async () => {
      // Arrange
      let resolve: () => void = () => undefined;
      client.onGetCapability = () =>
        new Promise((r) => {
          resolve = () => r(createFhirResponse(createCapabilitySubset({ software: { name: 'Late Server' } })));
        });
      fixture = TestBed.createComponent(FhirExplorer);
      host = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();

      // Act
      fixture.destroy();
      resolve();
      await new Promise((r) => setTimeout(r, 0));

      // Assert
      expect(fixture.componentInstance['sourceLabel']()).toBe('HAPI sandbox');
    });
  });

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(FhirExplorer);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function submit(): void {
    (host.querySelector('#fhir-search') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function family(): HTMLInputElement {
    return host.querySelector('#fhir-family') as HTMLInputElement;
  }

  function status(): HTMLElement {
    return host.querySelector('#fhir-status') as HTMLElement;
  }

  function rawToggle(): HTMLButtonElement {
    return host.querySelector('#fhir-raw-toggle') as HTMLButtonElement;
  }

  function raw(): HTMLElement {
    return host.querySelector('#fhir-raw') as HTMLElement;
  }

  function logText(): string {
    return host.querySelector('#fhir-log')?.textContent ?? '';
  }
});
