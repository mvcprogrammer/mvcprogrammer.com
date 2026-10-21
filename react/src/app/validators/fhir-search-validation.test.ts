import { BIRTHDATE_FORMAT_MESSAGE, FAMILY_LENGTH_MESSAGE, FAMILY_REQUIRED_MESSAGE, validateFhirSearch } from './fhir-search-validation';

describe('validateFhirSearch', () => {
  it('should accept the prefilled example', () => {
    // Act, Assert
    expect(validateFhirSearch({ family: 'Watsica', birthdate: '', identifier: '' })).toEqual({});
  });

  it('should require a family name and treat whitespace as missing', () => {
    // Act, Assert
    expect(validateFhirSearch({ family: '', birthdate: '', identifier: '' })).toEqual({ family: FAMILY_REQUIRED_MESSAGE });
    expect(validateFhirSearch({ family: '   ', birthdate: '', identifier: '' })).toEqual({ family: FAMILY_REQUIRED_MESSAGE });
  });

  it('should cap the family name at sixty characters', () => {
    // Act, Assert
    expect(validateFhirSearch({ family: 'a'.repeat(61), birthdate: '', identifier: '' })).toEqual({ family: FAMILY_LENGTH_MESSAGE });
    expect(validateFhirSearch({ family: 'a'.repeat(60), birthdate: '', identifier: '' })).toEqual({});
  });

  it('should accept an ISO birth date and reject any other shape', () => {
    // Act, Assert
    expect(validateFhirSearch({ family: 'Grant', birthdate: '1979-04-12', identifier: '' })).toEqual({});
    expect(validateFhirSearch({ family: 'Grant', birthdate: '1979-4-1', identifier: '' })).toEqual({ birthdate: BIRTHDATE_FORMAT_MESSAGE });
  });

  it('should report both fields at once', () => {
    // Act, Assert
    expect(validateFhirSearch({ family: '', birthdate: 'soon', identifier: '' })).toEqual({
      family: FAMILY_REQUIRED_MESSAGE,
      birthdate: BIRTHDATE_FORMAT_MESSAGE,
    });
  });
});
