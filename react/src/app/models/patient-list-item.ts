import type { Sex } from '../enumerations/sex';

/** One row of the patient search results, mapped from a FHIR `Patient` (see api/openapi.yaml). */
export interface PatientListItem {
  /** FHIR logical id. */
  readonly id: string;

  /** Display name, `Family, Given`. */
  readonly name: string;

  readonly familyName: string;
  readonly givenName?: string;

  /** ISO 8601 date. */
  readonly birthDate?: string;

  /** Year of birthDate, for the row label. */
  readonly birthYear?: number;

  readonly sex?: Sex;

  /** Medical record number, when the patient carries one. */
  readonly mrn?: string;
}
