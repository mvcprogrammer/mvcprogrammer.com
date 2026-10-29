import { PatientDemographics } from './patient-demographics';
import { Trace } from './trace';

/** What a write returns: the patient as the summary would now show it, and the trace of the upstream calls. Mirrors PatientWriteResult in openapi.yaml. */
export interface PatientWriteResult {
  readonly patient: PatientDemographics;
  readonly trace: Trace;
}
