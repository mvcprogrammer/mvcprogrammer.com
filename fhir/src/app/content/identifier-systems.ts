/**
 * The identifier system the HL7 ETL (`api/src/Hl7.Etl`) stamps on every patient it loads. The
 * function lets any session add and resolve conditions on those patients, so the explorer treats
 * them like the session's own for the condition form and the Resolve actions; the patients
 * themselves stay read-only to replace, patch, and delete. A mirror of `FhirOptions.CohortIdentifierSystem`.
 */
export const ETL_COHORT_SYSTEM = 'https://mvcprogrammer.com/fhir/etl';
