import { WorkMode } from '../enumerations/work-mode';
import { createPosition } from '../../testing/test-data';
import { placeLabel } from './place-label';

describe('placeLabel', () => {
  it('should label a remote position Remote whatever its location says', () => {
    // Arrange
    const position = createPosition({ workMode: WorkMode.Remote, location: 'Tampa' });

    // Act
    const label = placeLabel(position);

    // Assert
    expect(label).toBe('Remote');
  });

  it('should label a hybrid position Hybrid', () => {
    // Arrange
    const position = createPosition({ workMode: WorkMode.Hybrid, location: 'Tampa' });

    // Act
    const label = placeLabel(position);

    // Assert
    expect(label).toBe('Hybrid');
  });

  it('should use the location for an on-site position', () => {
    // Arrange
    const position = createPosition({ workMode: WorkMode.OnSite, location: 'Clearwater, FL' });

    // Act
    const label = placeLabel(position);

    // Assert
    expect(label).toBe('Clearwater, FL');
  });

  it('should fall back to On-site when an on-site position has no location', () => {
    // Arrange
    const position = createPosition({ workMode: WorkMode.OnSite, location: '  ' });

    // Act
    const label = placeLabel(position);

    // Assert
    expect(label).toBe('On-site');
  });
});
