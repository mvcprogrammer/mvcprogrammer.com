import type { Conditions } from './conditions';
import type { PatientDemographics } from './patient-demographics';
import type { ResourceCounts } from './resource-counts';
import type { Trace } from './trace';
import type { VitalSign } from './vital-sign';

/** Envelope returned by GET /api/fhir/patients/{id}/summary. */
export interface PatientSummary {
  readonly patient: PatientDemographics;
  readonly counts: ResourceCounts;
  readonly conditions: Conditions;

  /** Newest first, at most 25. */
  readonly vitals: readonly VitalSign[];

  readonly trace: Trace;
}
