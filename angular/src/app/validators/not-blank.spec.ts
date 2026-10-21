import { FormControl } from '@angular/forms';
import { notBlank } from './not-blank';

describe('notBlank', () => {
  it('should report required for an empty or whitespace value', () => {
    // Assert
    expect(notBlank(new FormControl('', { nonNullable: true }))).toEqual({ required: true });
    expect(notBlank(new FormControl('   ', { nonNullable: true }))).toEqual({ required: true });
  });

  it('should accept a value with any non-space character', () => {
    // Assert
    expect(notBlank(new FormControl(' W ', { nonNullable: true }))).toBeNull();
  });
});
