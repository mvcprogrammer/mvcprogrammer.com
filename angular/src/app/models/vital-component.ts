/** One `Observation.component`, used by blood pressure (systolic and diastolic). */
export interface VitalComponent {
  readonly name: string;
  readonly loincCode: string;
  readonly value: number;
  readonly unit: string;
}
