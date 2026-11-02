import { makeDay, makeVisit } from '../../testing/fixtures';
import { normalizeDayFile, normalizeVisit } from './normalize';

describe('normalizeVisit', () => {
  it('should map the explorer host from an older day file to its id', () => {
    // Arrange
    const visit = makeVisit({ editions: ['js', 'fhir.mvcprogrammer.com'], fhirCalls: 2 });

    // Act
    const normalized = normalizeVisit(visit);

    // Assert
    expect(normalized.editions).toEqual(['js', 'fhir']);
    expect(normalized.fhirCalls).toBe(2); // everything else is kept
  });

  it('should not list the id twice when a file carries both the host and the id', () => {
    expect(normalizeVisit(makeVisit({ editions: ['fhir', 'fhir.mvcprogrammer.com'] })).editions).toEqual(['fhir']);
  });

  it('should return the same object when there is nothing to change', () => {
    // Arrange
    const visit = makeVisit({ editions: ['react'] });

    // Assert
    expect(normalizeVisit(visit)).toBe(visit);
  });
});

describe('normalizeDayFile', () => {
  it('should normalize every visit and keep the file totals', () => {
    // Arrange
    const file = makeDay('2026-10-30', [makeVisit({ editions: ['fhir.mvcprogrammer.com'] }), makeVisit({ token: 'b', editions: ['blazor'] })], 120, 30);

    // Act
    const normalized = normalizeDayFile(file);

    // Assert
    expect(normalized.visits.map((visit) => visit.editions)).toEqual([['fhir'], ['blazor']]);
    expect(normalized.requests).toBe(120);
    expect(normalized.scannerRequests).toBe(30);
    expect(normalized.day).toBe('2026-10-30');
  });

  it('should return the same file when no visit needed a change', () => {
    // Arrange
    const file = makeDay('2026-11-02', [makeVisit({ editions: ['fhir'] })]);

    // Assert
    expect(normalizeDayFile(file)).toBe(file);
  });
});
