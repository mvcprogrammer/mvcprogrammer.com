import { FormControl, FormGroup } from '@angular/forms';
import { REPLY_BY_PHONE, phoneRequiredForCall } from './phone-required-for-call';

describe('phoneRequiredForCall', () => {
  it('should pass when a reply by email is requested, whatever the phone value', () => {
    // Arrange
    const form = createForm('Email', '');

    // Act
    const errors = phoneRequiredForCall(form.controls.phone);

    // Assert
    expect(errors).toBeNull();
  });

  it('should fail when a call is requested without a number', () => {
    // Arrange
    const form = createForm(REPLY_BY_PHONE, '   ');

    // Act
    const errors = phoneRequiredForCall(form.controls.phone);

    // Assert
    expect(errors).toEqual({ phoneRequired: 'Please enter a phone number so I can call you.' });
  });

  it('should fail when a call is requested with a number that is too short', () => {
    // Arrange
    const form = createForm(REPLY_BY_PHONE, '55501');

    // Act
    const errors = phoneRequiredForCall(form.controls.phone);

    // Assert
    expect(errors).not.toBeNull();
  });

  it('should pass when a call is requested with a number', () => {
    // Arrange
    const form = createForm(REPLY_BY_PHONE, '727-555-0100');

    // Act
    const errors = phoneRequiredForCall(form.controls.phone);

    // Assert
    expect(errors).toBeNull();
  });

  it('should pass for a control without a parent', () => {
    // Arrange
    const control = new FormControl('');

    // Act
    const errors = phoneRequiredForCall(control);

    // Assert
    expect(errors).toBeNull();
  });

  function createForm(reply: string, phone: string) {
    return new FormGroup({ reply: new FormControl(reply), phone: new FormControl(phone) });
  }
});
