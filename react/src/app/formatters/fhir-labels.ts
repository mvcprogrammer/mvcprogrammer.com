import type { ConditionItem } from '../models/condition-item';
import type { PatientListItem } from '../models/patient-list-item';
import type { PatientSummary } from '../models/patient-summary';
import type { VitalSign } from '../models/vital-sign';

/** Avatar colour classes available in the stylesheet. */
export const AVATAR_HUES = 8;

/** A vital sign's date split for the table: the date on one line, the local time under it. */
export interface DateParts {
  readonly date: string;
  readonly time: string;
}

/**
 * A stable colour per patient id, so the same patient keeps its avatar between searches.
 * @param id The FHIR logical id.
 */
export function hueOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }

  return hash % AVATAR_HUES;
}

/**
 * The avatar's classes: base, the small variant for list rows, and the hue.
 * @param id The patient id the hue is keyed on.
 * @param small True for the list row avatar.
 */
export function avatarClass(id: string, small: boolean): string {
  return `fhir-avatar${small ? ' fhir-avatar-sm' : ''} fhir-avatar-${hueOf(id)}`;
}

/**
 * One or two letters for a list row's avatar, from the given and family names.
 * @param patient The search row.
 */
export function initialsOf(patient: PatientListItem): string {
  const given = patient.givenName ? patient.givenName.charAt(0) : '';
  const family =
    patient.familyName && patient.familyName !== 'Unknown' ? patient.familyName.charAt(0) : '';
  return (given + family).toUpperCase() || '?';
}

/**
 * The line under a list row's name: birth year, sex, and the resource reference.
 * @param patient The search row.
 */
export function rowLabel(patient: PatientListItem): string {
  return [
    patient.birthYear ? `born ${patient.birthYear}` : 'birth year unknown',
    patient.sex ?? null,
    `Patient/${patient.id}`,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

/**
 * The age for the summary header, or the birth date, or a note that neither is known.
 * @param summary The patient summary.
 */
export function ageLabel(summary: PatientSummary): string {
  const patient = summary.patient;
  if (patient.age !== undefined) {
    return `${patient.age} years`;
  }

  return patient.birthDate ? `born ${patient.birthDate}` : 'age unknown';
}

/**
 * The code shown on a condition pill, prefixed with its system label when that is informative.
 * @param condition The condition.
 */
export function pillCode(condition: ConditionItem): string {
  return (
    (condition.systemLabel && condition.systemLabel !== 'other' ? `${condition.systemLabel} ` : '') +
    (condition.code ?? '')
  );
}

/**
 * The pill's tooltip, when the condition has an onset date.
 * @param condition The condition.
 */
export function pillTitle(condition: ConditionItem): string | undefined {
  return condition.onsetDate
    ? `Onset ${condition.onsetDate} · ${condition.clinicalStatus}`
    : undefined;
}

/**
 * A number rounded to two decimals, or an empty string when absent.
 * @param value The value.
 */
export function numberLabel(value: number | undefined): string {
  return typeof value === 'number' ? String(Math.round(value * 100) / 100) : '';
}

/**
 * The value column of the vitals table: components joined with a slash (blood pressure), else value and unit.
 * @param vital The vital sign.
 */
export function vitalValue(vital: VitalSign): string {
  if (vital.components && vital.components.length > 0) {
    return `${vital.components.map((component) => numberLabel(component.value)).join('/')} ${vital.components[0]!.unit}`.trim();
  }

  return `${numberLabel(vital.value)} ${vital.unit ?? ''}`.trim();
}

/**
 * "2025-11-03T09:14:00Z" becomes the local date and time; a bare date or year has no time.
 * @param iso The ISO 8601 date or date-time.
 */
export function dateParts(iso: string): DateParts {
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

/**
 * The X-Cache note for the log.
 * @param xCache CloudFront's X-Cache header, or null when no edge answered.
 */
export function describeCache(xCache: string | null): string {
  return xCache === null ? 'X-Cache: n/a (no CloudFront in front of this origin)' : `X-Cache: ${xCache}`;
}
