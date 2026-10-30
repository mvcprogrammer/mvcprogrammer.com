/** One entry of the condition pick list: a SNOMED CT concept id and its display, as the addCondition operation in ../../api/openapi.yaml documents them. */
export interface PickListCondition {
  readonly code: string;
  readonly display: string;
}
