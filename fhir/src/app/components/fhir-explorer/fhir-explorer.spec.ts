import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FhirProblemError } from '../../exceptions/fhir-problem-error';
import { FhirExplorer } from './fhir-explorer';
import { Sex } from '../../enumerations/sex';
import { createSiteTestServices, textOf, type } from '../../../testing/site-testing';
import { FakeDemoSession } from '../../../testing/fake-demo-session';
import { FakeFhirClient } from '../../../testing/fake-fhir-client';
import {
  createCapabilitySubset,
  createEmptyPatientSearchResult,
  createFhirResponse,
  createOwnPatientSummary,
  createPatientListItem,
  createPatientSearchResult,
  createPatientSummary,
  createPatientWriteResult,
} from '../../../testing/test-data';

describe('FhirExplorer', () => {
  let client: FakeFhirClient;
  let session: FakeDemoSession;
  let fixture: ComponentFixture<FhirExplorer>;
  let host: HTMLElement;

  beforeEach(async () => {
    const services = createSiteTestServices();
    client = services.fhir;
    session = services.session;
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

  describe('edit panel', () => {
    it('should start with nothing selected and the form empty, create enabled, the other verbs disabled', async () => {
      // Act
      await render();

      // Assert
      expect(target().textContent).toBe(FhirExplorer.EDIT_NONE_MESSAGE);
      expect(editField('familyName').value).toBe('');
      expect(button('fhir-create').disabled).toBe(false);
      expect(button('fhir-replace').disabled).toBe(true);
      expect(button('fhir-patch').disabled).toBe(true);
      expect(button('fhir-delete').disabled).toBe(true);
      expect(host.querySelector('.fhir-edit-lead')?.textContent).toBe(FhirExplorer.EDIT_LEAD);
    });

    it('should fill the form from a loaded summary and call another session\'s patient read-only here', async () => {
      // Arrange
      await render();

      // Act
      submit();
      await fixture.whenStable();

      // Assert
      expect(editField('familyName').value).toBe('Watsica258');
      expect(editField('givenName').value).toBe('Kimi714');
      expect((host.querySelector('#fhir-edit-sex') as HTMLSelectElement).value).toBe('female');
      expect(editField('birthDate').value).toBe('1963-03-02');
      expect(editField('mrn').value).toBe('eed8a921');
      expect(target().textContent).toContain('Patient/78785 was not created in this session');
      expect(target().classList.contains('is-mine')).toBe(false);
      expect(button('fhir-replace').disabled).toBe(true);
    });

    it('should call the seeded patient read-only and enable the verbs for a patient this session created', async () => {
      // Arrange
      client.onSearchPatients = () => Promise.resolve(createFhirResponse(createPatientSearchResult(createPatientListItem({ id: 'mvc-programmer' }), createPatientListItem({ id: 'mine-1' }))));
      client.onGetSummary = (id) => Promise.resolve(createFhirResponse(id === 'mine-1' ? createOwnPatientSummary() : { ...createPatientSummary(), patient: { ...createPatientSummary().patient, id } }));
      await render();
      submit();
      await fixture.whenStable();

      // Assert: the seed
      expect(target().textContent).toContain('Patient/mvc-programmer is the seeded demo patient and is read-only here');
      expect(button('fhir-delete').disabled).toBe(true);

      // Act: select the session's own patient
      (host.querySelector('.fhir-patient[data-id="mine-1"]') as HTMLButtonElement).click();
      await fixture.whenStable();

      // Assert
      expect(target().textContent).toContain('Editing Patient/mine-1, created in this session');
      expect(target().classList.contains('is-mine')).toBe(true);
      expect(button('fhir-replace').disabled).toBe(false);
      expect(button('fhir-delete').disabled).toBe(false);
      // Nothing changed yet, so there is nothing to patch.
      expect(button('fhir-patch').disabled).toBe(true);
    });

    it('should refuse to create without a family name or with a bad MRN, without calling the API', async () => {
      // Arrange
      await render();
      type(editField('mrn'), 'has space');

      // Act
      editSubmit();
      await fixture.whenStable();

      // Assert
      expect(host.querySelector('#fhir-edit-familyName-error')?.textContent).toBe(FhirExplorer.FAMILY_REQUIRED_MESSAGE);
      expect(host.querySelector('#fhir-edit-mrn-error')?.textContent).toBe(FhirExplorer.EDIT_MRN_MESSAGE);
      expect(client.creates).toEqual([]);
    });

    it('should create with the session\'s key, log the write, list and select the new patient, and renew the key', async () => {
      // Arrange
      await render();
      client.onGetSummary = (id) => Promise.resolve(createFhirResponse(createOwnPatientSummary(id)));
      type(editField('familyName'), 'Dickens');
      type(editField('givenName'), 'Charles');
      type(editField('mrn'), 'MVC-0042');

      // Act
      editSubmit();
      await fixture.whenStable();

      // Assert
      const create = client.creates[0];
      expect(create.input).toEqual({ familyName: 'Dickens', givenName: 'Charles', mrn: 'MVC-0042' });
      expect(create.key).toBe(session.keys[0]);
      expect(textOf(editStatus())).toContain('Created Patient/new-1');
      expect(host.querySelector('.fhir-patient[data-id="new-1"] .fhir-patient-name')?.textContent).toBe('Dickens, Charles');
      expect(client.summaryCalls).toEqual(['new-1']);
      expect(target().textContent).toContain('Editing Patient/new-1');
      const log = logText();
      expect(log).toContain(`→ POST /api/fhir/patients · X-Demo-Session ${FakeDemoSession.TOKEN} · Idempotency-Key ${create.key}`);
      expect(log).toContain('← 201 /patients');
      expect(log).toContain('↳ POST https://hapi.fhir.org/baseR4/Patient');
      expect(log).toContain('created Patient/new-1 · mapped to PatientWriteResult');

      // Act: a second create takes a new key
      editSubmit();
      await fixture.whenStable();

      // Assert
      expect(client.creates[1].key).toBe(session.keys[1]);
      expect(client.creates[1].key).not.toBe(create.key);
    });

    it('should reuse the key on a retry after a failure and show the function\'s field errors', async () => {
      // Arrange
      await render();
      type(editField('familyName'), 'Dickens');
      client.onCreatePatient = () =>
        Promise.reject(new FhirProblemError('One or more fields are invalid.', 400, 'Validation failed', 30, null, false, { familyName: ['too long for the sandbox'] }));

      // Act
      editSubmit();
      await fixture.whenStable();
      editSubmit();
      await fixture.whenStable();

      // Assert
      expect(client.creates).toHaveLength(2);
      expect(client.creates[0].key).toBe(client.creates[1].key);
      expect(textOf(editStatus())).toBe('One or more fields are invalid.');
      expect(editStatus().classList.contains('is-error')).toBe(true);
      expect(host.querySelector('#fhir-edit-familyName-error')?.textContent).toBe('too long for the sandbox');
      expect(logText()).toContain('← 400 /patients: Validation failed');
      expect(logText()).toContain('familyName: too long for the sandbox');
    });

    it('should say that the key had already created the patient on a 200', async () => {
      // Arrange
      await render();
      client.onCreatePatient = (input) => Promise.resolve(createFhirResponse(createPatientWriteResult(input, 'again-1'), { status: 200, xCache: null, etag: null }));
      client.onGetSummary = (id) => Promise.resolve(createFhirResponse(createOwnPatientSummary(id)));
      type(editField('familyName'), 'Dickens');

      // Act
      editSubmit();
      await fixture.whenStable();

      // Assert
      expect(textOf(editStatus())).toContain('had already been created with this key');
      expect(logText()).toContain('already created by this key, returned Patient/again-1');
    });

    it('should replace the selected patient with the whole form and reload its summary', async () => {
      // Arrange
      await selectOwnPatient();
      type(editField('givenName'), 'Chuck');
      type(editField('mrn'), '');

      // Act
      button('fhir-replace').click();
      await fixture.whenStable();

      // Assert
      const replace = client.replaces[0];
      expect(replace.id).toBe('mine-1');
      expect(replace.input).toEqual({ familyName: 'Watsica258', givenName: 'Chuck', sex: Sex.Female, birthDate: '1963-03-02' });
      expect(textOf(editStatus())).toBe('Replaced Patient/mine-1.');
      // The summary is not re-read; the card, the row, and the form follow the write result.
      expect(client.summaryCalls).toEqual(['mine-1']);
      expect(host.querySelector('#fhir-card-name')?.textContent).toBe('Watsica258, Chuck');
      expect(host.querySelector('.fhir-patient[data-id="mine-1"] .fhir-patient-name')?.textContent).toBe('Watsica258, Chuck');
      expect(editField('givenName').value).toBe('Chuck');
      expect(button('fhir-patch').disabled).toBe(true);
      expect(logText()).toContain(`→ PUT /api/fhir/patients/mine-1 · X-Demo-Session ${FakeDemoSession.TOKEN}`);
    });

    it('should patch only the changed fields, each guarded by a test of the old value', async () => {
      // Arrange
      await selectOwnPatient();
      type(editField('givenName'), 'Chuck');
      type(editField('mrn'), '');

      // Act
      fixture.detectChanges();
      expect(button('fhir-patch').disabled).toBe(false);
      button('fhir-patch').click();
      await fixture.whenStable();

      // Assert
      const patch = client.patches[0];
      expect(patch.id).toBe('mine-1');
      expect(patch.operations).toEqual([
        { op: 'test', path: '/givenName', value: 'Kimi714' },
        { op: 'replace', path: '/givenName', value: 'Chuck' },
        { op: 'test', path: '/mrn', value: 'eed8a921' },
        { op: 'remove', path: '/mrn' },
      ]);
      expect(textOf(editStatus())).toBe('Patched Patient/mine-1.');
      expect(logText()).toContain('→ PATCH /api/fhir/patients/mine-1 · application/json-patch+json');
      expect(logText()).toContain('replace /givenName = "Chuck"');
    });

    it('should show a 409 from a patch as the status and leave the patient as it was', async () => {
      // Arrange
      await selectOwnPatient();
      type(editField('givenName'), 'Chuck');
      client.onPatchPatient = () => Promise.reject(new FhirProblemError("Operation 0 ('test' on /givenName) failed; the patient was not changed.", 409, 'Patch not applied', 40, null, false));
      fixture.detectChanges();

      // Act
      button('fhir-patch').click();
      await fixture.whenStable();

      // Assert
      expect(textOf(editStatus())).toContain('failed; the patient was not changed');
      expect(client.summaryCalls).toEqual(['mine-1']);
      expect(logText()).toContain('← 409 /patients/mine-1: Patch not applied');
    });

    it('should delete the selected patient, drop its row, clear the summary, and keep the form', async () => {
      // Arrange
      await selectOwnPatient();

      // Act
      button('fhir-delete').click();
      await fixture.whenStable();

      // Assert
      expect(client.deletes).toEqual(['mine-1']);
      expect(host.querySelector('.fhir-patient[data-id="mine-1"]')).toBeNull();
      expect(host.querySelector('#fhir-summary-empty')?.textContent).toContain('Patient/mine-1 was deleted');
      expect(target().textContent).toBe(FhirExplorer.EDIT_NONE_MESSAGE);
      expect(editField('familyName').value).toBe('Watsica258');
      expect(textOf(editStatus())).toBe('Deleted Patient/mine-1.');
      expect(logText()).toContain('← 204 /patients/mine-1');
    });

    it('should show an upstream failure of a delete as the status', async () => {
      // Arrange
      await selectOwnPatient();
      client.onDeletePatient = () => Promise.reject(new FhirProblemError(FhirProblemError.UPSTREAM_MESSAGE, 502, 'FHIR sandbox unavailable', 900, null, false));

      // Act
      button('fhir-delete').click();
      await fixture.whenStable();

      // Assert
      expect(textOf(editStatus())).toBe(FhirProblemError.UPSTREAM_MESSAGE);
      expect(host.querySelector('.fhir-patient[data-id="mine-1"]')).not.toBeNull();
    });

    /** Searches, then selects a patient the fake session created. */
    async function selectOwnPatient(): Promise<void> {
      client.onSearchPatients = () => Promise.resolve(createFhirResponse(createPatientSearchResult(createPatientListItem({ id: 'mine-1', name: 'Watsica258, Kimi714' }))));
      client.onGetSummary = (id) => Promise.resolve(createFhirResponse(createOwnPatientSummary(id)));
      await render();
      submit();
      await fixture.whenStable();
    }
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

  function editSubmit(): void {
    (host.querySelector('#fhir-edit') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function editField(name: string): HTMLInputElement {
    return host.querySelector(`#fhir-edit-${name}`) as HTMLInputElement;
  }

  function button(id: string): HTMLButtonElement {
    return host.querySelector(`#${id}`) as HTMLButtonElement;
  }

  function target(): HTMLElement {
    return host.querySelector('#fhir-edit-target') as HTMLElement;
  }

  function editStatus(): HTMLElement {
    return host.querySelector('#fhir-edit-status') as HTMLElement;
  }

  function logText(): string {
    return host.querySelector('#fhir-log')?.textContent ?? '';
  }
});
