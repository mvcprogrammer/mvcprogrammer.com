import { Conditions } from './conditions';
import { PatientDemographics } from './patient-demographics';
import { ResourceCounts } from './resource-counts';
import { Trace } from './trace';
import { VitalSign } from './vital-sign';

/** Envelope returned by GET /api/fhir/patients/{id}/summary. */
export interface PatientSummary {
  readonly patient: PatientDemographics;
  readonly counts: ResourceCounts;
  readonly conditions: Conditions;

  /** Newest first, at most 25. */
  readonly vitals: readonly VitalSign[];

  readonly trace: Trace;
}
