import { ClinicalStatus } from '../enumerations/clinical-status';
import { createPatientListItem, createPatientSummary } from '../../testing/test-data';
import { ageLabel, avatarClass, dateParts, describeCache, hueOf, initialsOf, numberLabel, pillCode, pillTitle, rowLabel, vitalValue } from './fhir-labels';

describe('fhir labels', () => {
  describe('hueOf and avatarClass', () => {
    it('should give the same id the same hue within the available range', () => {
      // Act, Assert
      expect(hueOf('78785')).toBe(hueOf('78785'));
      expect(hueOf('78785')).toBeGreaterThanOrEqual(0);
      expect(hueOf('78785')).toBeLessThan(8);
      expect(avatarClass('78785', true)).toBe(`fhir-avatar fhir-avatar-sm fhir-avatar-${hueOf('78785')}`);
      expect(avatarClass('78785', false)).toBe(`fhir-avatar fhir-avatar-${hueOf('78785')}`);
    });
  });

  describe('initialsOf', () => {
    it('should take the first letters of the given and family names, skipping an unknown family', () => {
      // Act, Assert
      expect(initialsOf(createPatientListItem())).toBe('KW');
      expect(initialsOf(createPatientListItem({ givenName: undefined, familyName: 'Unknown' }))).toBe('?');
      expect(initialsOf(createPatientListItem({ givenName: undefined }))).toBe('W');
    });
  });

  describe('rowLabel', () => {
    it('should join the birth year, sex, and reference, skipping what is missing', () => {
      // Act, Assert
      expect(rowLabel(createPatientListItem())).toBe('born 1963 · female · Patient/78785');
      expect(rowLabel(createPatientListItem({ birthYear: undefined, sex: undefined }))).toBe('birth year unknown · Patient/78785');
    });
  });

  describe('ageLabel', () => {
    it('should prefer the age, then the birth date, then say unknown', () => {
      // Arrange
      const summary = createPatientSummary();

      // Act, Assert
      expect(ageLabel(summary)).toBe('63 years');
      expect(ageLabel({ ...summary, patient: { ...summary.patient, age: undefined } })).toBe('born 1963-03-02');
      expect(ageLabel({ ...summary, patient: { ...summary.patient, age: undefined, birthDate: undefined } })).toBe('age unknown');
    });
  });

  describe('pillCode and pillTitle', () => {
    it('should prefix a named system and title a dated onset', () => {
      // Arrange
      const condition = createPatientSummary().conditions.active[0]!;

      // Act, Assert
      expect(pillCode(condition)).toBe('SNOMED CT 59621000');
      expect(pillCode({ ...condition, systemLabel: 'other' })).toBe('59621000');
      expect(pillTitle(condition)).toBe('Onset 2010-05-01 · active');
      expect(pillTitle({ display: 'x', clinicalStatus: ClinicalStatus.Active })).toBeUndefined();
    });
  });

  describe('numberLabel and vitalValue', () => {
    it('should round to two decimals and join components with a slash', () => {
      // Arrange
      const [pressure, weight] = createPatientSummary().vitals;

      // Act, Assert
      expect(numberLabel(27.7449)).toBe('27.74');
      expect(numberLabel(undefined)).toBe('');
      expect(vitalValue(pressure!)).toBe('108/82 mm[Hg]');
      expect(vitalValue(weight!)).toBe('64.6 kg');
      expect(vitalValue({ date: '2026-01-01', name: 'x', loincCode: '1', value: 5 })).toBe('5');
    });
  });

  describe('dateParts', () => {
    it('should keep a bare date, split a date-time into local parts, and tolerate junk', () => {
      // Act, Assert
      expect(dateParts('2026-03-31')).toEqual({ date: '2026-03-31', time: '' });
      const parts = dateParts('2026-03-31T10:47:00Z');
      expect(parts.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(parts.time).toMatch(/^\d{2}:\d{2}$/);
      expect(dateParts('2026-03-31Tnonsense')).toEqual({ date: '2026-03-31', time: '' });
    });
  });

  describe('describeCache', () => {
    it('should name the header or say no edge answered', () => {
      // Act, Assert
      expect(describeCache('Hit from cloudfront')).toBe('X-Cache: Hit from cloudfront');
      expect(describeCache(null)).toBe('X-Cache: n/a (no CloudFront in front of this origin)');
    });
  });
});
