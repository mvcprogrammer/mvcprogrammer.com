/** What a visitor can write about a condition: the SNOMED CT code of one of the ten listed conditions. Mirrors ConditionInput in openapi.yaml. */
export interface ConditionInput {
  readonly code: string;
}
