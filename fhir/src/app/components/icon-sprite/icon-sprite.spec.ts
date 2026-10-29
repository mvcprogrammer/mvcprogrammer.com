import { TestBed } from '@angular/core/testing';
import { IconSprite } from './icon-sprite';

describe('IconSprite', () => {
  it.each(['github', 'linkedin', 'flickr', 'design', 'code', 'deploy', 'monitor', 'test', 'sun', 'moon', 'globe', 'data', 'mail', 'download'])(
    'should define the %s symbol',
    async (name) => {
      // Arrange
      const fixture = TestBed.createComponent(IconSprite);

      // Act
      await fixture.whenStable();

      // Assert
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector(`symbol#icon-${name}`)).not.toBeNull();
      expect(host.querySelector('svg')?.classList.contains('sr-only')).toBe(true);
    },
  );
});
