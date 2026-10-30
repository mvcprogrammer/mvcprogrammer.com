import { ClinicalStatus } from '../enumerations/clinical-status';

/** One FHIR `Condition`. The code is the first SNOMED CT or ICD-10 coding, else the first coding. */
export interface ConditionItem {
  /** The sandbox's logical id, as the write operations return it and a resolve addresses it. */
  readonly id?: string;

  readonly display: string;
  readonly code?: string;

  /** The coding system URI. */
  readonly system?: string;

  /** Short label for the pill: SNOMED CT, ICD-10-CM, ICD-10, or other. */
  readonly systemLabel?: string;

  readonly clinicalStatus: ClinicalStatus;
  readonly onsetDate?: string;
  readonly recordedDate?: string;
}
