/** The search as the FHIR function ran it, echoed back in a PatientSearchResult. */
export interface SearchQuery {
  readonly family: string;
  readonly birthdate?: string;
  readonly identifier?: string;
}
