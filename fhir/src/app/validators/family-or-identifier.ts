import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Fails the search form when both the family name and the identifier are blank, under the
 * `familyOrIdentifier` key: either one narrows a search enough, so the function requires at least one.
 * @param group The search form group with `family` and `identifier` controls.
 */
export function familyOrIdentifier(group: AbstractControl): ValidationErrors | null {
  const family = group.get('family')?.value;
  const identifier = group.get('identifier')?.value;
  const blank = (value: unknown): boolean => typeof value !== 'string' || value.trim() === '';
  return blank(family) && blank(identifier) ? { familyOrIdentifier: true } : null;
}
