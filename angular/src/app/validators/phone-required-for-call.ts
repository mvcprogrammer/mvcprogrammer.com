import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** The reply option that reveals and requires the phone field. */
export const REPLY_BY_PHONE = 'Phone call';

/** The shortest phone number the form accepts. */
export const PHONE_MIN_LENGTH = 7;

/**
 * Requires a phone number only when the sibling "reply" control asks for a call. Attached to the
 * phone control; the control is re-validated whenever the reply changes because the contact form
 * enables and disables it then.
 */
export const phoneRequiredForCall: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const reply: unknown = control.parent?.get('reply')?.value;
  if (reply !== REPLY_BY_PHONE) {
    return null;
  }

  const phone = typeof control.value === 'string' ? control.value.trim() : '';
  return phone.length < PHONE_MIN_LENGTH ? { phoneRequired: 'Please enter a phone number so I can call you.' } : null;
};
