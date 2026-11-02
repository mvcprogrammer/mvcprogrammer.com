/** The patient search as the explorer sends it to GET /api/fhir/patients. */
export interface PatientSearchRequest {
  /** Family name, or an empty string for none; matched by the sandbox as a case-insensitive prefix. One of family and identifier is given. */
  readonly family: string;

  /** ISO 8601 date, or an empty string for none. */
  readonly birthdate: string;

  /** Identifier value, or `system|value`, or an empty string for none. */
  readonly identifier: string;
}
