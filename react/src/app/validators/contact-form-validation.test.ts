import {
  REPLY_BY_PHONE,
  validateContactForm,
  type ContactFormValues,
} from './contact-form-validation';

/** A form that passes every rule; override what the test breaks. */
function createValues(overrides: Partial<ContactFormValues> = {}): ContactFormValues {
  return {
    name: 'Ada Lovelace',
    email: 'ada@example.test',
    topic: 'Job opportunity',
    reply: 'Email',
    phone: '',
    message: 'I would like to talk about a role.',
    website: '',
    ...overrides,
  };
}

describe('validateContactForm', () => {
  it('should accept a complete form asking for an email reply', () => {
    // Arrange
    const values = createValues();

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors).toEqual({});
  });

  it('should accept a complete form asking for a call with a phone number', () => {
    // Arrange
    const values = createValues({ reply: REPLY_BY_PHONE, phone: '727-555-0100' });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors).toEqual({});
  });

  it('should require a name', () => {
    // Arrange
    const values = createValues({ name: '   ' });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors.name).toBe('Please enter your name.');
  });

  it('should limit the name length', () => {
    // Arrange
    const values = createValues({ name: 'a'.repeat(121) });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors.name).toBe('Please keep your name under 120 characters.');
  });

  it('should require an email address', () => {
    // Arrange
    const values = createValues({ email: '' });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors.email).toBe('Please enter your email address.');
  });

  it.each(['not-an-email', 'two words@example.test', '@example.test', 'ada@'])(
    'should reject the email %j',
    (email) => {
      // Arrange
      const values = createValues({ email });

      // Act
      const errors = validateContactForm(values);

      // Assert
      expect(errors.email).toBe('Please enter a valid email address.');
    },
  );

  it('should limit the email length', () => {
    // Arrange
    const values = createValues({ email: `${'a'.repeat(195)}@x.test` });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors.email).toBe('Please enter a valid email address.');
  });

  it('should require a topic and a reply preference', () => {
    // Arrange
    const values = createValues({ topic: '', reply: '' });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors.topic).toBe('Please pick a topic.');
    expect(errors.reply).toBe('Please pick how you would like to hear back.');
  });

  it('should require a phone number only when a call is requested', () => {
    // Arrange
    const byEmail = createValues({ reply: 'Email', phone: '' });
    const byPhone = createValues({ reply: REPLY_BY_PHONE, phone: '' });

    // Act
    const emailErrors = validateContactForm(byEmail);
    const phoneErrors = validateContactForm(byPhone);

    // Assert
    expect(emailErrors.phone).toBeUndefined();
    expect(phoneErrors.phone).toBe('Please enter a phone number so I can call you.');
  });

  it('should reject a phone number shorter than seven characters when a call is requested', () => {
    // Arrange
    const values = createValues({ reply: REPLY_BY_PHONE, phone: ' 12345 ' });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors.phone).toBe('Please enter a phone number so I can call you.');
  });

  it('should limit the phone number length when a call is requested', () => {
    // Arrange
    const values = createValues({ reply: REPLY_BY_PHONE, phone: '1'.repeat(31) });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors.phone).toBe('Please keep the phone number under 30 characters.');
  });

  it('should ignore a short phone number when an email reply is requested', () => {
    // Arrange
    const values = createValues({ reply: 'Email', phone: '12' });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors.phone).toBeUndefined();
  });

  it('should require a message of at least ten characters', () => {
    // Arrange
    const values = createValues({ message: 'too short' });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors.message).toBe('Please write at least 10 characters.');
  });

  it('should limit the message length', () => {
    // Arrange
    const values = createValues({ message: 'a'.repeat(5001) });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(errors.message).toBe('Please keep the message under 5000 characters.');
  });

  it('should report every failed field at once', () => {
    // Arrange
    const values = createValues({ name: '', email: '', message: '' });

    // Act
    const errors = validateContactForm(values);

    // Assert
    expect(Object.keys(errors).sort()).toEqual(['email', 'message', 'name']);
  });
});
