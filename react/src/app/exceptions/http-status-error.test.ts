import { HttpStatusError } from './http-status-error';

describe('HttpStatusError', () => {
  it('should carry the status and the URL and describe both in the message', () => {
    // Arrange, Act
    const error = new HttpStatusError(429, 'https://contact.example.test/');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HttpStatusError');
    expect(error.status).toBe(429);
    expect(error.url).toBe('https://contact.example.test/');
    expect(error.message).toBe(
      'The request to https://contact.example.test/ failed with status 429.',
    );
  });
});
