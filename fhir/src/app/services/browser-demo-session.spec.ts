import { TestBed } from '@angular/core/testing';
import { BrowserDemoSession } from './browser-demo-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('BrowserDemoSession', () => {
  beforeEach(() => sessionStorage.clear());

  it('should mint a UUID token, keep it in sessionStorage, and reuse it', () => {
    // Act
    const first = TestBed.runInInjectionContext(() => new BrowserDemoSession());
    const second = TestBed.runInInjectionContext(() => new BrowserDemoSession());

    // Assert
    expect(first.token).toMatch(UUID);
    expect(sessionStorage.getItem(BrowserDemoSession.STORAGE_KEY)).toBe(first.token);
    expect(second.token).toBe(first.token);
  });

  it('should ignore a stored value that is not a UUID', () => {
    // Arrange
    sessionStorage.setItem(BrowserDemoSession.STORAGE_KEY, 'tampered');

    // Act
    const session = TestBed.runInInjectionContext(() => new BrowserDemoSession());

    // Assert
    expect(session.token).toMatch(UUID);
    expect(sessionStorage.getItem(BrowserDemoSession.STORAGE_KEY)).toBe(session.token);
  });

  it('should mint a different UUID key per call', () => {
    // Arrange
    const session = TestBed.runInInjectionContext(() => new BrowserDemoSession());

    // Act
    const keys = [session.newKey(), session.newKey(), session.newKey()];

    // Assert
    for (const key of keys) {
      expect(key).toMatch(UUID);
      expect(key).not.toBe(session.token);
    }

    expect(new Set(keys).size).toBe(3);
  });
});
