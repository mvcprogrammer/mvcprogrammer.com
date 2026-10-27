import { act, renderHook } from '@testing-library/react';
import { stripSignInParams, useQuery } from './use-query';

describe('stripSignInParams', () => {
  it('should drop the code and state the sign-in return adds and keep the rest', () => {
    expect(stripSignInParams('?code=abc&state=xyz')).toBe('');
    expect(stripSignInParams('?range=7d&code=abc&state=xyz&compare=1')).toBe('?range=7d&compare=1');
    expect(stripSignInParams('?range=7d')).toBe('?range=7d');
    expect(stripSignInParams('')).toBe('');
  });
});

describe('useQuery', () => {
  it('should resolve a named range in the URL against the given today, not the clock', () => {
    // Arrange
    window.history.replaceState(null, '', '/?range=7d');

    // Act
    const { result } = renderHook(() => useQuery('2026-10-18'));

    // Assert
    expect(result.current[0].preset).toBe('7d');
    expect(result.current[0].range).toEqual({ from: '2026-10-12', to: '2026-10-18' });
  });

  it('should re-read the URL against the same today on popstate', async () => {
    // Arrange
    window.history.replaceState(null, '', '/?range=7d');
    const { result } = renderHook(() => useQuery('2026-10-18'));

    // Act
    window.history.replaceState(null, '', '/?range=today');
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Assert
    expect(result.current[0].preset).toBe('today');
    expect(result.current[0].range).toEqual({ from: '2026-10-18', to: '2026-10-18' });
  });
});
