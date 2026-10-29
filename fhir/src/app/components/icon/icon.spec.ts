import { TestBed } from '@angular/core/testing';
import { Icon } from './icon';

describe('Icon', () => {
  it('should reference the sprite symbol for its name', async () => {
    // Arrange
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'github');

    // Act
    await fixture.whenStable();

    // Assert
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg.icon');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('use')?.getAttribute('href')).toBe('#icon-github');
  });
});
