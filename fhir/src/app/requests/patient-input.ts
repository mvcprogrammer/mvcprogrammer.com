import { Sex } from '../enumerations/sex';

/** What a visitor can write about a demo patient: the body of a create or replace, and the document a patch is applied to. Mirrors PatientInput in openapi.yaml. */
export interface PatientInput {
  readonly familyName: string;
  readonly givenName?: string;
  readonly sex?: Sex;
  readonly birthDate?: string;
  readonly mrn?: string;
}
