import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, PendingTasks, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FhirProblemError } from '../../exceptions/fhir-problem-error';
import { notBlank } from '../../validators/not-blank';
import { FhirClient } from '../../interfaces/fhir-client';
import { ConditionItem } from '../../models/condition-item';
import { FhirResponse } from '../../models/fhir-response';
import { LogLine } from '../../models/log-line';
import { PatientListItem } from '../../models/patient-list-item';
import { PatientSummary } from '../../models/patient-summary';
import { Trace } from '../../models/trace';
import { VitalSign } from '../../models/vital-sign';

/** A vital sign's date split for the table: the date on one line, the local time under it. */
interface DateParts {
  readonly date: string;
  readonly time: string;
}

/**
 * The FHIR R4 patient explorer inside the FHIR API card: search, the patient list, the summary
 * card, and the "under the hood" log. Rendered only once the card's accordion opens, so the first
 * request to /api/fhir (the capability check) happens then.
 */
@Component({
  selector: 'app-fhir-explorer',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fhir-explorer.html',
})
export class FhirExplorer implements OnInit, OnDestroy {
  /** Base path of the API, for the log and the status line. */
  static readonly API = '/api/fhir';

  /** The prefilled example and the names tried in turn when it returns nothing (the sandbox is wiped now and then). */
  static readonly FALLBACK_FAMILIES: readonly string[] = ['Watsica', 'Grant', 'Meridius', 'Deshmukh', 'Smith', 'Johnson', 'Williams'];

  /** Lines kept in the log. */
  static readonly LOG_LIMIT = 60;

  /** Avatar colour classes available in the stylesheet. */
  static readonly AVATAR_HUES = 8;

  /** Pages the function follows per search, used when a trace does not say. */
  static readonly PAGE_CAP = 5;

  static readonly FAMILY_REQUIRED_MESSAGE = 'A family name is required.';
  static readonly FAMILY_LENGTH_MESSAGE = 'At most 60 characters.';
  static readonly BIRTHDATE_FORMAT_MESSAGE = 'Use the YYYY-MM-DD form.';
  static readonly NO_MATCH_MESSAGE = 'No patients match. Try another family name; the sandbox is wiped now and then.';
  static readonly LIST_PROMPT = 'Run a search to list matching patients.';
  static readonly SUMMARY_PROMPT = 'Select a patient to load the summary: demographics, counts, active conditions, and recent vital signs.';
  static readonly SUMMARY_SELECT_PROMPT = 'Select a patient to load the summary.';
  static readonly SUMMARY_UPSTREAM_MESSAGE = 'The sandbox did not answer in time. The explorer will work again as soon as it does.';
  static readonly SUMMARY_FAILED_MESSAGE = 'Nothing to show.';
  static readonly RAW_FAILED_MESSAGE = 'The raw bundle could not be loaded.';

  protected readonly form = inject(FormBuilder).nonNullable.group({
    family: [FhirExplorer.FALLBACK_FAMILIES[0], [notBlank, Validators.maxLength(60)]],
    birthdate: ['', [Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    identifier: ['', [Validators.maxLength(120)]],
  });

  /** True once a submit found the form invalid; errors show from then on. */
  protected readonly validated = signal(false);
  protected readonly statusText = signal('');
  protected readonly statusKind = signal<'is-ok' | 'is-error' | ''>('');
  protected readonly searching = signal(false);

  /** Null before the first search. */
  protected readonly patients = signal<readonly PatientListItem[] | null>(null);
  protected readonly countLabel = signal('');
  protected readonly listMessage = signal(FhirExplorer.LIST_PROMPT);

  protected readonly selectedId = signal<string | null>(null);
  protected readonly summary = signal<PatientSummary | null>(null);
  protected readonly summaryMessage = signal(FhirExplorer.SUMMARY_PROMPT);
  protected readonly summaryBusy = signal(false);
  protected readonly resolvedShown = signal(false);

  protected readonly lines = signal<readonly LogLine[]>([{ text: '$ waiting for the first search', kind: '' }]);
  protected readonly dtoName = signal<string | null>(null);
  protected readonly dtoJson = signal('');
  protected readonly rawOpen = signal(false);
  protected readonly rawText = signal('');
  protected readonly sourceLabel = signal('HAPI sandbox');

  protected readonly rawDisabled = computed(() => this.summary() === null);
  protected readonly dtoLabel = computed(() => `The ${this.dtoName() ?? 'DTO'} the function returned`);
  protected readonly statusClass = computed(() => (this.statusKind() === '' ? 'form-status' : `form-status ${this.statusKind()}`));
  protected readonly resolvedLabel = computed(() => {
    const count = this.summary()?.conditions.resolved.length ?? 0;
    return (this.resolvedShown() ? 'hide ' : '+') + `${count} resolved`;
  });

  private readonly client = inject(FhirClient);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private rawLoadedFor: string | null = null;
  private destroyed = false;

  constructor() {
    // The log keeps its newest line in view, as a terminal does.
    afterRenderEffect(() => {
      this.lines();
      const log = this.log()?.nativeElement;
      if (log !== undefined) {
        log.scrollTop = log.scrollHeight;
      }
    });
  }

  /** @inheritdoc */
  ngOnInit(): void {
    void this.pendingTasks.run(() => this.checkCapability());
  }

  /** @inheritdoc */
  ngOnDestroy(): void {
    // A response that arrives after this point is dropped rather than applied to a dead view.
    this.destroyed = true;
  }

  protected familyError(): string {
    const control = this.form.controls.family;
    if (!this.validated() || control.valid) {
      return '';
    }

    return control.hasError('required') ? FhirExplorer.FAMILY_REQUIRED_MESSAGE : FhirExplorer.FAMILY_LENGTH_MESSAGE;
  }

  protected birthdateError(): string {
    return this.validated() && this.form.controls.birthdate.invalid ? FhirExplorer.BIRTHDATE_FORMAT_MESSAGE : '';
  }

  protected avatarClass(id: string, small: boolean): string {
    return `fhir-avatar${small ? ' fhir-avatar-sm' : ''} fhir-avatar-${FhirExplorer.hueOf(id)}`;
  }

  protected initialsOf(patient: PatientListItem): string {
    const given = patient.givenName ? patient.givenName.charAt(0) : '';
    const family = patient.familyName && patient.familyName !== 'Unknown' ? patient.familyName.charAt(0) : '';
    return (given + family).toUpperCase() || '?';
  }

  protected rowLabel(patient: PatientListItem): string {
    return [patient.birthYear ? `born ${patient.birthYear}` : 'birth year unknown', patient.sex ?? null, `Patient/${patient.id}`]
      .filter((part) => part !== null)
      .join(' · ');
  }

  protected ageLabel(summary: PatientSummary): string {
    const patient = summary.patient;
    if (patient.age !== undefined) {
      return `${patient.age} years`;
    }

    return patient.birthDate ? `born ${patient.birthDate}` : 'age unknown';
  }

  protected pillCode(condition: ConditionItem): string {
    return (condition.systemLabel && condition.systemLabel !== 'other' ? `${condition.systemLabel} ` : '') + (condition.code ?? '');
  }

  protected pillTitle(condition: ConditionItem): string | null {
    return condition.onsetDate ? `Onset ${condition.onsetDate} · ${condition.clinicalStatus}` : null;
  }

  protected vitalValue(vital: VitalSign): string {
    if (vital.components && vital.components.length > 0) {
      return `${vital.components.map((component) => FhirExplorer.number(component.value)).join('/')} ${vital.components[0].unit}`.trim();
    }

    return `${FhirExplorer.number(vital.value)} ${vital.unit ?? ''}`.trim();
  }

  /** "2025-11-03T09:14:00Z" becomes the local date and time; a bare date or year has no time. */
  protected dateParts(iso: string): DateParts {
    if (iso.length <= 10) {
      return { date: iso, time: '' };
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return { date: iso.slice(0, 10), time: '' };
    }

    const pad = (n: number): string => (n < 10 ? '0' : '') + n;
    return {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
  }

  /** Validates, then searches. The prefilled example walks the fallback list when it returns nothing. */
  protected submit(): void {
    if (this.form.invalid) {
      this.validated.set(true);
      return;
    }

    this.validated.set(false);
    const value = this.form.getRawValue();
    const family = value.family.trim();
    const identifier = value.identifier.trim();
    const usingTheExample = family === FhirExplorer.FALLBACK_FAMILIES[0] && value.birthdate === '' && identifier === '';
    void this.pendingTasks.run(() => this.search(family, value.birthdate, identifier, usingTheExample ? 1 : null));
  }

  protected select(id: string): void {
    void this.pendingTasks.run(() => this.loadSummary(id));
  }

  protected toggleResolved(): void {
    this.resolvedShown.update((shown) => !shown);
  }

  protected toggleRaw(): void {
    const id = this.selectedId();
    if (id === null || this.summary() === null) {
      return;
    }

    if (this.rawOpen()) {
      this.rawOpen.set(false);
      return;
    }

    this.rawOpen.set(true);
    if (this.rawLoadedFor !== id) {
      void this.pendingTasks.run(() => this.loadRaw(id));
    }
  }

  private async search(family: string, birthdate: string, identifier: string, fallbackIndex: number | null): Promise<void> {
    this.searching.set(true);
    this.setStatus('Searching…', '');
    const path = `/patients?family=${encodeURIComponent(family)}` + (birthdate ? `&birthdate=${encodeURIComponent(birthdate)}` : '') + (identifier ? `&identifier=${encodeURIComponent(identifier)}` : '');
    this.write(`→ GET ${FhirExplorer.API}${path}`, 'request');

    try {
      const response = await this.client.searchPatients({ family, birthdate, identifier });
      if (this.destroyed) {
        return;
      }

      const result = response.body;
      this.writeResponse('/patients', response);
      this.writeTrace(result.trace, response);
      this.write(`  mapped to PatientSearchResult: ${result.count} ${result.count === 1 ? 'item' : 'items'}${result.trace.truncated ? ' (one page; more matches exist)' : ''}`, 'detail');
      this.showDto('PatientSearchResult', result);

      // The prefilled example may have been wiped from the sandbox; walk the fallback list once, without extra inputs.
      if (result.count === 0 && !birthdate && !identifier && fallbackIndex !== null && fallbackIndex < FhirExplorer.FALLBACK_FAMILIES.length) {
        const next = FhirExplorer.FALLBACK_FAMILIES[fallbackIndex];
        this.write(`  nothing for "${family}"; the sandbox may have been wiped, trying "${next}"`, 'note');
        this.form.controls.family.setValue(next);
        this.searching.set(false);
        await this.search(next, '', '', fallbackIndex + 1);
        return;
      }

      this.patients.set(result.items);
      this.countLabel.set(result.count === 0 ? '(0)' : `(${result.count}${result.total !== undefined && result.total > result.count ? ` of ${result.total}` : ''})`);
      this.listMessage.set(FhirExplorer.NO_MATCH_MESSAGE);
      this.setStatus(result.count === 0 ? 'No matches.' : `${result.count} ${result.count === 1 ? 'patient' : 'patients'} for “${family}”; the first is selected.`, 'is-ok');
      if (result.items.length > 0) {
        await this.loadSummary(result.items[0].id);
      } else {
        this.showSummaryMessage(FhirExplorer.SUMMARY_SELECT_PROMPT);
      }
    } catch (error: unknown) {
      if (this.destroyed) {
        return;
      }

      const problem = FhirExplorer.asProblem(error);
      this.writeFailure('/patients', problem);
      this.patients.set([]);
      this.countLabel.set('(0)');
      this.listMessage.set(problem.message);
      this.showSummaryMessage(problem.upstreamFailed ? FhirExplorer.SUMMARY_UPSTREAM_MESSAGE : FhirExplorer.SUMMARY_FAILED_MESSAGE);
      this.setStatus(problem.message, 'is-error');
    } finally {
      this.searching.set(false);
    }
  }

  private async loadSummary(id: string): Promise<void> {
    this.selectedId.set(id);
    this.rawLoadedFor = null;
    this.rawOpen.set(false);
    this.summaryBusy.set(true);
    const path = `/patients/${encodeURIComponent(id)}/summary`;
    this.write(`→ GET ${FhirExplorer.API}${path}`, 'request');

    try {
      const response = await this.client.getSummary(id);
      if (this.destroyed || this.selectedId() !== id) {
        return;
      }

      const body = response.body;
      this.writeResponse(path, response);
      this.writeTrace(body.trace, response);
      this.write(`  mapped to PatientSummary: ${body.conditions.active.length} active and ${body.conditions.resolved.length} resolved conditions, ${body.vitals.length} vital signs`, 'detail');
      this.showDto('PatientSummary', body);
      this.resolvedShown.set(false);
      this.summary.set(body);
    } catch (error: unknown) {
      if (this.destroyed || this.selectedId() !== id) {
        return;
      }

      const problem = FhirExplorer.asProblem(error);
      this.writeFailure(path, problem);
      this.showSummaryMessage(problem.message);
    } finally {
      if (this.selectedId() === id) {
        this.summaryBusy.set(false);
      }
    }
  }

  private async loadRaw(id: string): Promise<void> {
    this.rawText.set('loading…');
    const path = `/patients/${encodeURIComponent(id)}/raw`;
    this.write(`→ GET ${FhirExplorer.API}${path}`, 'request');

    try {
      const response = await this.client.getRawBundle(id);
      if (this.destroyed || this.selectedId() !== id) {
        return;
      }

      this.write(`← ${response.status} ${response.contentType ?? ''} in ${response.durationMs} ms · ${FhirExplorer.describeCache(response.xCache)} · ${response.body.length} bytes`, 'response');
      this.rawText.set(response.body);
      this.rawLoadedFor = id;
    } catch (error: unknown) {
      if (this.destroyed || this.selectedId() !== id) {
        return;
      }

      const problem = FhirExplorer.asProblem(error);
      this.writeFailure(path, problem);
      this.rawText.set(problem.status === 0 ? FhirExplorer.RAW_FAILED_MESSAGE : `The raw bundle could not be loaded (${problem.status}).`);
    }
  }

  private async checkCapability(): Promise<void> {
    this.write(`→ GET ${FhirExplorer.API}/capability`, 'request');
    try {
      const response = await this.client.getCapability();
      if (this.destroyed) {
        return;
      }

      const capability = response.body;
      this.writeResponse('/capability', response);
      const missing: string[] = [];
      for (const resource of capability.resources) {
        if (!resource.supported) {
          missing.push(resource.type);
        }

        for (const param of resource.searchParams) {
          if (!param.supported) {
            missing.push(`${resource.type}?${param.name}`);
          }
        }
      }

      const software = capability.software?.name ? `${capability.software.name} ${capability.software.version ?? ''}`.trim() : 'sandbox';
      this.write(`  ${software} · FHIR ${capability.fhirVersion} at ${capability.baseUrl} · checked ${capability.checkedAt}`, 'detail');
      this.write(capability.ok ? '  every resource and search parameter the explorer needs is supported ✓' : `  not supported: ${missing.join(', ')}`, capability.ok ? 'detail' : 'error');
      if (capability.baseUrl) {
        this.sourceLabel.set(/hapi\.fhir\.org/.test(capability.baseUrl) ? 'HAPI sandbox' : (capability.software?.name ?? 'FHIR sandbox'));
      }
    } catch (error: unknown) {
      if (!this.destroyed) {
        this.write(`  capability check failed: ${FhirExplorer.asProblem(error).message}`, 'error');
      }
    }
  }

  private showSummaryMessage(message: string): void {
    this.summary.set(null);
    this.summaryMessage.set(message);
  }

  private showDto(name: string, value: unknown): void {
    this.dtoName.set(name);
    this.dtoJson.set(JSON.stringify(value, null, 2));
  }

  private setStatus(text: string, kind: 'is-ok' | 'is-error' | ''): void {
    this.statusText.set(text);
    this.statusKind.set(kind);
  }

  private write(text: string, kind: LogLine['kind']): void {
    this.lines.update((lines) => [...lines, { text, kind }].slice(-FhirExplorer.LOG_LIMIT));
  }

  private writeResponse(path: string, response: FhirResponse<unknown>): void {
    this.write(`← ${response.status} ${path} in ${response.durationMs} ms · ${FhirExplorer.describeCache(response.xCache)} · ETag ${response.etag ?? 'none'}`, 'response');
  }

  private writeFailure(path: string, problem: FhirProblemError): void {
    if (problem.status === 0) {
      this.write(problem.timedOut ? `← timed out after ${problem.durationMs} ms` : '← network error', 'error');
      return;
    }

    this.write(`← ${problem.status} ${path}${problem.title ? `: ${problem.title}` : ''} in ${problem.durationMs} ms · ${FhirExplorer.describeCache(problem.xCache)}`, 'error');
  }

  private writeTrace(trace: Trace, response: FhirResponse<unknown>): void {
    if (/^hit/i.test(response.xCache ?? '')) {
      this.write(`  served from the CloudFront cache; the upstream numbers below are from the original request at ${trace.generatedAt}`, 'note');
    }

    for (const request of trace.requests) {
      this.write(`  ↳ ${request.method} ${request.url}`, 'upstream');
      this.write(`    ${request.status} · ${request.durationMs} ms · ${request.entries} ${request.entries === 1 ? 'entry' : 'entries'} · ${request.pages} ${request.pages === 1 ? 'page' : 'pages'}`, 'detail');
    }

    const count = trace.requests.length;
    this.write(
      `  ${count} upstream ${count === 1 ? 'request' : 'requests'} in ${trace.totalDurationMs} ms wall time · ${trace.bundleEntries} bundle ${trace.bundleEntries === 1 ? 'entry' : 'entries'} · ${trace.pagesWalked} ${trace.pagesWalked === 1 ? 'page' : 'pages'} walked (cap ${trace.pageCap || FhirExplorer.PAGE_CAP} per search)${trace.truncated ? ' · truncated' : ''}`,
      'detail',
    );
  }

  private static describeCache(xCache: string | null): string {
    return xCache === null ? 'X-Cache: n/a (no CloudFront in front of this origin)' : `X-Cache: ${xCache}`;
  }

  private static asProblem(error: unknown): FhirProblemError {
    return error instanceof FhirProblemError ? error : FhirProblemError.from(error, 0);
  }

  private static number(value: number | undefined): string {
    return typeof value === 'number' ? String(Math.round(value * 100) / 100) : '';
  }

  /** A stable colour per patient id, so the same patient keeps its avatar between searches. */
  private static hueOf(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }

    return hash % FhirExplorer.AVATAR_HUES;
  }
}
