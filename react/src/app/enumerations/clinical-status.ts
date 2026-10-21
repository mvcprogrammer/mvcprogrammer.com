/** A `Condition.clinicalStatus` code as the sandbox sent it. Active, recurrence, and relapse count as active. */
export const ClinicalStatus = {
  Active: 'active',
  Recurrence: 'recurrence',
  Relapse: 'relapse',
  Inactive: 'inactive',
  Remission: 'remission',
  Resolved: 'resolved',
  Unknown: 'unknown',
} as const;

/** One of the ClinicalStatus values. */
export type ClinicalStatus = (typeof ClinicalStatus)[keyof typeof ClinicalStatus];
