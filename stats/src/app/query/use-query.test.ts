import { stripSignInParams } from './use-query';

describe('stripSignInParams', () => {
  it('should drop the code and state the sign-in return adds and keep the rest', () => {
    expect(stripSignInParams('?code=abc&state=xyz')).toBe('');
    expect(stripSignInParams('?range=7d&code=abc&state=xyz&compare=1')).toBe('?range=7d&compare=1');
    expect(stripSignInParams('?range=7d')).toBe('?range=7d');
    expect(stripSignInParams('')).toBe('');
  });
});
