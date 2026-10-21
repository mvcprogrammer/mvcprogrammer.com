/** FHIR `Patient.gender` (AdministrativeGender), passed through unchanged by the FHIR API. */
export const Sex = {
  Male: 'male',
  Female: 'female',
  Other: 'other',
  Unknown: 'unknown',
} as const;

/** One of the Sex values. */
export type Sex = (typeof Sex)[keyof typeof Sex];
