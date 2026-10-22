import { render } from '@testing-library/react';
import { IconSprite } from './IconSprite';

describe('IconSprite', () => {
  it.each([
    'github',
    'linkedin',
    'flickr',
    'design',
    'code',
    'deploy',
    'monitor',
    'test',
    'sun',
    'moon',
    'data',
    'mail',
    'download',
  ])('should define the icon-%s symbol the page references', (name) => {
    // Arrange, Act
    const { container } = render(<IconSprite />);

    // Assert
    const symbol = container.querySelector(`symbol#icon-${name}`);
    expect(symbol).not.toBeNull();
    expect(symbol?.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('should be hidden from assistive technology and visually', () => {
    // Arrange, Act
    const { container } = render(<IconSprite />);

    // Assert
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toBe('sr-only');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('symbol').length).toBe(13);
  });
});
