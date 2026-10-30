import { PickListCondition } from '../models/pick-list-condition';

/**
 * The ten conditions a visitor may add, in the order the select lists them. A mirror of the
 * function's list (`ConditionPickList` in ../../api/src/Fhir.Api), which is the source of truth: a
 * code it does not know answers 422, so this copy only ever offers what the function accepts.
 */
export const CONDITION_PICK_LIST: readonly PickListCondition[] = [
  { code: '59621000', display: 'Essential hypertension' },
  { code: '44054006', display: 'Type 2 diabetes mellitus' },
  { code: '55822004', display: 'Hyperlipidemia' },
  { code: '195967001', display: 'Asthma' },
  { code: '13645005', display: 'Chronic obstructive pulmonary disease' },
  { code: '235595009', display: 'Gastroesophageal reflux disease' },
  { code: '40930008', display: 'Hypothyroidism' },
  { code: '396275006', display: 'Osteoarthritis' },
  { code: '35489007', display: 'Depressive disorder' },
  { code: '49436004', display: 'Atrial fibrillation' },
];
