import { FormControl, FormGroup } from '@angular/forms';
import { familyOrIdentifier } from './family-or-identifier';

describe('familyOrIdentifier', () => {
  function group(family: string, identifier: string): FormGroup {
    return new FormGroup({ family: new FormControl(family, { nonNullable: true }), identifier: new FormControl(identifier, { nonNullable: true }) });
  }

  it('should fail when both are blank or whitespace', () => {
    expect(familyOrIdentifier(group('', ''))).toEqual({ familyOrIdentifier: true });
    expect(familyOrIdentifier(group('   ', ' '))).toEqual({ familyOrIdentifier: true });
  });

  it('should pass when either one is given', () => {
    expect(familyOrIdentifier(group('Programmer', ''))).toBeNull();
    expect(familyOrIdentifier(group('', 'mvcprogrammer.com'))).toBeNull();
    expect(familyOrIdentifier(group('Programmer', 'mvcprogrammer.com'))).toBeNull();
  });

  it('should fail a group without the two controls', () => {
    expect(familyOrIdentifier(new FormGroup({}))).toEqual({ familyOrIdentifier: true });
  });
});
