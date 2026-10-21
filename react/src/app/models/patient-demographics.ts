import type { Sex } from '../enumerations/sex';
import type { Identifier } from './identifier';

/** The summary card header, mapped from a FHIR `Patient`. */
export interface PatientDemographics {
  readonly id: string;
  readonly name: string;
  readonly familyName: string;
  readonly givenName?: string;

  /** One or two uppercase letters for the avatar. */
  readonly initials: string;

  readonly sex?: Sex;
  readonly birthDate?: string;

  /** Whole years at the time of the request, when the birth date is known. */
  readonly age?: number;

  readonly mrn?: string;
  readonly identifiers: readonly Identifier[];
}
