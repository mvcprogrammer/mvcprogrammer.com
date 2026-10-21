/** The search fields as the explorer holds them. */
export interface FhirSearchValues {
  readonly family: string;
  readonly birthdate: string;
  readonly identifier: string;
}

/** The first problem found per field; a field with no entry is valid. */
export interface FhirSearchErrors {
  readonly family?: string;
  readonly birthdate?: string;
}

/** The longest family name the function accepts. */
export const FAMILY_MAX_LENGTH = 60;

/** The longest identifier the function accepts. */
export const IDENTIFIER_MAX_LENGTH = 120;

export const FAMILY_REQUIRED_MESSAGE = 'A family name is required.';
export const FAMILY_LENGTH_MESSAGE = 'At most 60 characters.';
export const BIRTHDATE_FORMAT_MESSAGE = 'Use the YYYY-MM-DD form.';

const BIRTHDATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Applies the static edition's rules: a trimmed family name of at most sixty characters, and a
 * birth date, when given, in ISO form.
 * @param values The search as the visitor filled it.
 */
export function validateFhirSearch(values: FhirSearchValues): FhirSearchErrors {
  const errors: { family?: string; birthdate?: string } = {};
  const family = values.family.trim();
  if (family === '') {
    errors.family = FAMILY_REQUIRED_MESSAGE;
  } else if (family.length > FAMILY_MAX_LENGTH) {
    errors.family = FAMILY_LENGTH_MESSAGE;
  }

  if (values.birthdate !== '' && !BIRTHDATE_PATTERN.test(values.birthdate)) {
    errors.birthdate = BIRTHDATE_FORMAT_MESSAGE;
  }

  return errors;
}
