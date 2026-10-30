import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, PendingTasks, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Sex } from '../../enumerations/sex';
import { FhirProblemError } from '../../exceptions/fhir-problem-error';
import { notBlank } from '../../validators/not-blank';
import { DemoSession } from '../../interfaces/demo-session';
import { FhirClient } from '../../interfaces/fhir-client';
import { ConditionItem } from '../../models/condition-item';
import { PatientDemographics } from '../../models/patient-demographics';
import { FhirResponse } from '../../models/fhir-response';
import { LogLine } from '../../models/log-line';
import { PatientListItem } from '../../models/patient-list-item';
import { PatientSummary } from '../../models/patient-summary';
import { PatientWriteResult } from '../../models/patient-write-result';
import { Trace } from '../../models/trace';
import { VitalSign } from '../../models/vital-sign';
import { PatientInput } from '../../requests/patient-input';
import { PatientPatchOperation, PatientPatchPath } from '../../requests/patient-patch-operation';

/** A vital sign's date split for the table: the date on one line, the local time under it. */
interface DateParts {
  readonly date: string;
  readonly time: string;
}

/** Whose the selected patient is, which decides what the edit panel may do to it. */
export type Ownership = 'none' | 'mine' | 'seed' | 'other';

/** The edit form's fields, in the order they are patched. */
const EDIT_FIELDS: readonly PatientPatchPath[] = ['/familyName', '/givenName', '/sex', '/birthDate', '/mrn'];

/**
 * The FHIR R4 patient explorer, the one page of fhir.mvcprogrammer.com: search, the patient list, the
 * summary card, the edit panel (create, replace, patch, delete under the demo guard), and the "under
 * the hood" log. The first request to /api/fhir (the capability check) happens when the page renders.
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
  static readonly FALLBACK_FAMILIES: readonly string[] = ['Programmer', 'Grant', 'Meridius', 'Deshmukh', 'Smith', 'Johnson', 'Williams'];

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

  /** The seeded demo patient, read-only to the writes. */
  static readonly SEED_PATIENT_ID = 'mvc-programmer';

  static readonly EDIT_LEAD = 'Writes go to the same throwaway sandbox. Only patients created in this browser session can be replaced, patched, or deleted; the seeded patient is read-only. A session can create five.';
  static readonly EDIT_NONE_MESSAGE = 'No patient selected: the form creates a new one.';
  static readonly EDIT_MRN_MESSAGE = 'Letters, digits, hyphens, and dots only; at most 40.';
  static readonly EDIT_NO_CHANGES_MESSAGE = 'Nothing changed since the patient was loaded, so there is nothing to patch.';
  static readonly BLOCK_NONE_MESSAGE = 'No patient is selected. Search and pick one, or create a new one.';
  static readonly BLOCK_SEED_MESSAGE = 'The seeded demo patient is read-only. Create a patient of your own and change that.';
  static readonly BLOCK_OTHER_MESSAGE = 'This patient was not created in this session, so it cannot be changed here. Create a patient of your own.';
  static readonly BLOCK_WRITING_MESSAGE = 'A write is in flight; wait for it to finish.';

  protected readonly form = inject(FormBuilder).nonNullable.group({
    family: [FhirExplorer.FALLBACK_FAMILIES[0], [notBlank, Validators.maxLength(60)]],
    birthdate: ['', [Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    identifier: ['', [Validators.maxLength(120)]],
  });

  protected readonly EDIT_LEAD = FhirExplorer.EDIT_LEAD;

  /** What a new patient starts as, so Create works without typing and the result names the site. */
  static readonly NEW_PATIENT: Readonly<Record<'familyName' | 'givenName' | 'mrn', string>> = { familyName: 'Patient', givenName: 'Demo', mrn: 'mvcprogrammer.com' };

  protected readonly editForm = inject(FormBuilder).nonNullable.group({
    familyName: [FhirExplorer.NEW_PATIENT.familyName, [notBlank, Validators.maxLength(60)]],
    givenName: [FhirExplorer.NEW_PATIENT.givenName, [Validators.maxLength(60)]],
    sex: [''],
    birthDate: ['', [Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    mrn: [FhirExplorer.NEW_PATIENT.mrn, [Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9\-.]*$/)]],
  });

  /** True once a write found the edit form invalid; its errors show from then on. */
  protected readonly editValidated = signal(false);
  protected readonly writing = signal(false);
  protected readonly editStatusText = signal('');
  protected readonly editStatusKind = signal<'is-ok' | 'is-error' | ''>('');

  /** The function's field errors from the last 400, keyed by field. */
  protected readonly serverErrors = signal<Readonly<Record<string, readonly string[]>>>({});

  /** The input view of the selected patient when its summary loaded, the document a patch is diffed against. */
  protected readonly loadedInput = signal<PatientInput | null>(null);

  /** The edit form as a signal, so the ownership and diff computations follow it. */
  private readonly editValue = signal(this.editForm.getRawValue());

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

  protected readonly ownership = computed<Ownership>(() => {
    const summary = this.summary();
    if (summary === null) {
      return 'none';
    }

    if (summary.patient.id === FhirExplorer.SEED_PATIENT_ID) {
      return 'seed';
    }

    const mine = summary.patient.identifiers.some((i) => i.system === DemoSession.SESSION_SYSTEM && i.value === this.session.token);
    return mine ? 'mine' : 'other';
  });
  protected readonly editTarget = computed(() => {
    const id = this.summary()?.patient.id;
    switch (this.ownership()) {
      case 'mine':
        return `Editing Patient/${id}, created in this session: replace, patch, and delete are allowed.`;
      case 'seed':
        return `Patient/${id} is the seeded demo patient and is read-only here. The form can create a new patient.`;
      case 'other':
        return `Patient/${id} was not created in this session, so it cannot be changed here. The form can create a new patient.`;
      default:
        return FhirExplorer.EDIT_NONE_MESSAGE;
    }
  });
  protected readonly canChange = computed(() => this.ownership() === 'mine' && !this.writing());

  protected readonly hasChanges = computed(() => {
    const loaded = this.loadedInput();
    return loaded !== null && FhirExplorer.patchOperations(loaded, FhirExplorer.toInput(this.editValue())).length > 0;
  });
  protected readonly editStatusClass = computed(() => (this.editStatusKind() === '' ? 'form-status' : `form-status ${this.editStatusKind()}`));

  /** Why a create is blocked right now, or null: shown on hover and on a blocked press. */
  protected readonly createBlock = computed(() => (this.writing() ? FhirExplorer.BLOCK_WRITING_MESSAGE : null));

  /** Why a replace or delete is blocked right now, or null. */
  protected readonly changeBlock = computed(() => this.blockReason(false));

  /** Why a patch is blocked right now, or null; a patch also needs something to have changed. */
  protected readonly patchBlock = computed(() => this.blockReason(true));

  private readonly client = inject(FhirClient);
  private readonly session = inject(DemoSession);
  private readonly pendingTasks = inject(PendingTasks);
  /** The idempotency key of the create in progress or retried; renewed once a create succeeds. */
  private createKey: string | null = null;
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private rawLoadedFor: string | null = null;
  private destroyed = false;

  constructor() {
    this.editForm.valueChanges.subscribe(() => this.editValue.set(this.editForm.getRawValue()));

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

  /** A field's message: the form's own rule once a write was attempted, else what the function said about it. */
  protected editError(field: 'familyName' | 'givenName' | 'sex' | 'birthDate' | 'mrn'): string {
    const control = this.editForm.controls[field];
    if (this.editValidated() && control.invalid) {
      if (control.hasError('required')) {
        return FhirExplorer.FAMILY_REQUIRED_MESSAGE;
      }

      if (field === 'birthDate') {
        return FhirExplorer.BIRTHDATE_FORMAT_MESSAGE;
      }

      return field === 'mrn' ? FhirExplorer.EDIT_MRN_MESSAGE : FhirExplorer.FAMILY_LENGTH_MESSAGE;
    }

    return this.serverErrors()[field]?.[0] ?? '';
  }

  /** POST: validates the form and creates a new patient with the pending idempotency key. */
  protected create(): void {
    if (this.sayWhyBlocked(this.createBlock())) {
      return;
    }

    const input = this.validatedInput();
    if (input === null) {
      return;
    }

    this.createKey ??= this.session.newKey();
    const key = this.createKey;
    void this.pendingTasks.run(() => this.createPatient(input, key));
  }

  /** PUT: validates the form and replaces the selected patient's demographics with it. */
  protected replace(): void {
    if (this.sayWhyBlocked(this.changeBlock())) {
      return;
    }

    const id = this.changeableId();
    const input = this.validatedInput();
    if (id === null || input === null) {
      return;
    }

    void this.pendingTasks.run(() => this.replacePatient(id, input));
  }

  /** PATCH: sends only what changed since the patient was loaded, each change guarded by a test of the old value. */
  protected patch(): void {
    if (this.sayWhyBlocked(this.patchBlock())) {
      return;
    }

    const id = this.changeableId();
    const loaded = this.loadedInput();
    const input = this.validatedInput();
    if (id === null || loaded === null || input === null) {
      return;
    }

    void this.pendingTasks.run(() => this.patchPatient(id, FhirExplorer.patchOperations(loaded, input)));
  }

  /** DELETE the selected patient. */
  protected remove(): void {
    if (this.sayWhyBlocked(this.changeBlock())) {
      return;
    }

    const id = this.changeableId();
    if (id === null) {
      return;
    }

    void this.pendingTasks.run(() => this.deletePatient(id));
  }

  /** The reason a change to the selected patient is blocked, or null when it may go ahead. */
  private blockReason(needsChanges: boolean): string | null {
    if (this.writing()) {
      return FhirExplorer.BLOCK_WRITING_MESSAGE;
    }

    switch (this.ownership()) {
      case 'none':
        return FhirExplorer.BLOCK_NONE_MESSAGE;
      case 'seed':
        return FhirExplorer.BLOCK_SEED_MESSAGE;
      case 'other':
        return FhirExplorer.BLOCK_OTHER_MESSAGE;
      default:
        return needsChanges && !this.hasChanges() ? FhirExplorer.EDIT_NO_CHANGES_MESSAGE : null;
    }
  }

  /** Writes a block reason to the panel's status, so a keyboard or screen-reader user gets what the hover shows. True when blocked. */
  private sayWhyBlocked(reason: string | null): boolean {
    if (reason === null) {
      return false;
    }

    this.setEditStatus(reason, '');
    return true;
  }

  /** The selected patient's id when this session may change it and no write is in flight. */
  private changeableId(): string | null {
    return this.canChange() ? (this.summary()?.patient.id ?? null) : null;
  }

  /** The form as PatientInput after its own validation, or null with the errors showing. */
  private validatedInput(): PatientInput | null {
    this.serverErrors.set({});
    if (this.editForm.invalid) {
      this.editValidated.set(true);
      return null;
    }

    this.editValidated.set(false);
    return FhirExplorer.toInput(this.editForm.getRawValue());
  }

  private async createPatient(input: PatientInput, key: string): Promise<void> {
    this.writing.set(true);
    this.setEditStatus('Creating…', '');
    this.write(`→ POST ${FhirExplorer.API}/patients · X-Demo-Session ${this.session.token} · Idempotency-Key ${key}`, 'request');

    try {
      const response = await this.client.createPatient(input, key);
      if (this.destroyed) {
        return;
      }

      const result = response.body;
      this.createKey = null;
      this.writeResponse('/patients', response);
      this.writeTrace(result.trace, response);
      this.write(`  ${response.status === 201 ? 'created' : 'already created by this key, returned'} Patient/${result.patient.id} · mapped to PatientWriteResult`, 'detail');
      this.showDto('PatientWriteResult', result);
      this.showCreated(result.patient);
      this.setEditStatus(response.status === 201 ? `Created Patient/${result.patient.id}; it is selected and yours to change.` : `Patient/${result.patient.id} had already been created with this key; nothing new was made.`, 'is-ok');
      await this.loadSummary(result.patient.id);
    } catch (error: unknown) {
      this.failWrite('/patients', error);
    } finally {
      this.writing.set(false);
    }
  }

  private async replacePatient(id: string, input: PatientInput): Promise<void> {
    const path = `/patients/${encodeURIComponent(id)}`;
    this.writing.set(true);
    this.setEditStatus('Replacing…', '');
    this.write(`→ PUT ${FhirExplorer.API}${path} · X-Demo-Session ${this.session.token}`, 'request');

    try {
      const response = await this.client.replacePatient(id, input);
      if (this.destroyed) {
        return;
      }

      this.afterChange(path, response, 'Replaced');
    } catch (error: unknown) {
      this.failWrite(path, error);
    } finally {
      this.writing.set(false);
    }
  }

  private async patchPatient(id: string, operations: readonly PatientPatchOperation[]): Promise<void> {
    const path = `/patients/${encodeURIComponent(id)}`;
    this.writing.set(true);
    this.setEditStatus('Patching…', '');
    this.write(`→ PATCH ${FhirExplorer.API}${path} · application/json-patch+json · X-Demo-Session ${this.session.token}`, 'request');
    for (const op of operations) {
      this.write(`  ${op.op} ${op.path}${op.value !== undefined ? ` = ${JSON.stringify(op.value)}` : ''}`, 'detail');
    }

    try {
      const response = await this.client.patchPatient(id, operations);
      if (this.destroyed) {
        return;
      }

      this.afterChange(path, response, 'Patched');
    } catch (error: unknown) {
      this.failWrite(path, error);
    } finally {
      this.writing.set(false);
    }
  }

  private async deletePatient(id: string): Promise<void> {
    const path = `/patients/${encodeURIComponent(id)}`;
    this.writing.set(true);
    this.setEditStatus('Deleting…', '');
    this.write(`→ DELETE ${FhirExplorer.API}${path} · X-Demo-Session ${this.session.token}`, 'request');

    try {
      const response = await this.client.deletePatient(id);
      if (this.destroyed) {
        return;
      }

      this.write(`← ${response.status} ${path} in ${response.durationMs} ms · ${FhirExplorer.describeCache(response.xCache)}`, 'response');
      this.patients.update((list) => (list ?? []).filter((p) => p.id !== id));
      this.countLabel.set(`(${this.patients()?.length ?? 0})`);
      this.selectedId.set(null);
      this.loadedInput.set(null);
      this.showSummaryMessage(`Patient/${id} was deleted. The form still holds its fields, so it can be created again.`);
      this.setEditStatus(`Deleted Patient/${id}.`, 'is-ok');
    } catch (error: unknown) {
      this.failWrite(path, error);
    } finally {
      this.writing.set(false);
    }
  }

  /**
   * Logs a replace or patch and applies the patient it returned to the row, the summary card, and
   * the form. The summary is not re-read: the browser and CloudFront may hold the old one for a
   * while (max-age 60, s-maxage 600), and the write result is the record as the sandbox stored it.
   */
  private afterChange(path: string, response: FhirResponse<PatientWriteResult>, verb: string): void {
    const result = response.body;
    this.writeResponse(path, response);
    this.writeTrace(result.trace, response);
    this.write(`  ${verb.toLowerCase()} Patient/${result.patient.id} · mapped to PatientWriteResult; the card and form follow it (a cached summary may lag for a few minutes)`, 'detail');
    this.showDto('PatientWriteResult', result);
    this.patients.update((list) => (list ?? []).map((p) => (p.id === result.patient.id ? FhirExplorer.toListItem(result.patient) : p)));
    this.summary.update((summary) => (summary !== null && summary.patient.id === result.patient.id ? { ...summary, patient: result.patient } : summary));
    this.loadIntoForm(result.patient);
    this.setEditStatus(`${verb} Patient/${result.patient.id}.`, 'is-ok');
  }

  /** Adds the new patient to the top of the list so it can be selected like any match. */
  private showCreated(patient: PatientDemographics): void {
    this.patients.update((list) => [FhirExplorer.toListItem(patient), ...(list ?? []).filter((p) => p.id !== patient.id)]);
    this.countLabel.set(`(${this.patients()?.length ?? 0})`);
    this.listMessage.set(FhirExplorer.NO_MATCH_MESSAGE);
  }

  private failWrite(path: string, error: unknown): void {
    if (this.destroyed) {
      return;
    }

    const problem = FhirExplorer.asProblem(error);
    this.writeFailure(path, problem);
    this.serverErrors.set(problem.errors);
    for (const [field, messages] of Object.entries(problem.errors)) {
      this.write(`  ${field}: ${messages.join(' ')}`, 'error');
    }

    this.setEditStatus(problem.message, 'is-error');
  }

  private setEditStatus(text: string, kind: 'is-ok' | 'is-error' | ''): void {
    this.editStatusText.set(text);
    this.editStatusKind.set(kind);
  }

  /** Puts a loaded patient's fields in the form and remembers them as the patch baseline. */
  private loadIntoForm(patient: PatientDemographics): void {
    const input: PatientInput = {
      familyName: patient.familyName === 'Unknown' ? '' : patient.familyName,
      givenName: patient.givenName,
      sex: patient.sex,
      birthDate: patient.birthDate,
      mrn: patient.mrn,
    };
    this.editForm.setValue({
      familyName: input.familyName,
      givenName: input.givenName ?? '',
      sex: input.sex ?? '',
      birthDate: input.birthDate ?? '',
      mrn: input.mrn ?? '',
    });
    this.loadedInput.set(input);
    this.editValidated.set(false);
    this.serverErrors.set({});
  }

  /** The form's raw value as the body the function takes: trimmed, blanks omitted. */
  private static toInput(value: { familyName: string; givenName: string; sex: string; birthDate: string; mrn: string }): PatientInput {
    const text = (s: string): string | undefined => (s.trim() === '' ? undefined : s.trim());
    return {
      familyName: value.familyName.trim(),
      givenName: text(value.givenName),
      sex: text(value.sex) as Sex | undefined,
      birthDate: text(value.birthDate),
      mrn: text(value.mrn),
    };
  }

  /** RFC 6902 operations that take `before` to `after`: a test of the old value, then add, replace, or remove, per changed field. */
  static patchOperations(before: PatientInput, after: PatientInput): PatientPatchOperation[] {
    const operations: PatientPatchOperation[] = [];
    for (const path of EDIT_FIELDS) {
      const field = path.slice(1) as keyof PatientInput;
      const was = before[field];
      const now = after[field];
      if (was === now) {
        continue;
      }

      if (was !== undefined) {
        operations.push({ op: 'test', path, value: was });
      }

      if (now === undefined) {
        operations.push({ op: 'remove', path });
      } else {
        operations.push({ op: was === undefined ? 'add' : 'replace', path, value: now });
      }
    }

    return operations;
  }

  private static toListItem(patient: PatientDemographics): PatientListItem {
    return {
      id: patient.id,
      name: patient.name,
      familyName: patient.familyName,
      givenName: patient.givenName,
      birthDate: patient.birthDate,
      birthYear: patient.birthDate ? Number(patient.birthDate.slice(0, 4)) : undefined,
      sex: patient.sex,
      mrn: patient.mrn,
    };
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
      this.loadIntoForm(body.patient);
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
