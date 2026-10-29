import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Fails a text control whose value is empty or whitespace, under the `required` error key so the
 * message matches the static edition's trimmed required check.
 * @param control The control to validate.
 */
export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim() === '' ? { required: true } : null;
}
