import { WorkMode } from '../enumerations/work-mode';
import { createPosition } from '../../testing/test-data';
import { PlaceLabelPipe } from './place-label';

describe('PlaceLabelPipe', () => {
  describe('transform', () => {
    it.each([
      [WorkMode.Remote, 'Tampa', 'Remote'],
      [WorkMode.Hybrid, 'Tampa', 'Hybrid'],
      [WorkMode.OnSite, 'Florida', 'Florida'],
      [WorkMode.OnSite, '', 'On-site'],
      [WorkMode.OnSite, '   ', 'On-site'],
    ])('should follow the work mode %s with location %j to give %s', (workMode, location, expected) => {
      // Arrange
      const pipe = new PlaceLabelPipe();

      // Act
      const label = pipe.transform(createPosition({ workMode, location }));

      // Assert
      expect(label).toBe(expected);
    });
  });
});
