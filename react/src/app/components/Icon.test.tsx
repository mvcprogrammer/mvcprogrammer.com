import { render } from '@testing-library/react';
import { Icon } from './Icon';

describe('Icon', () => {
  it('should reference the sprite symbol for its name and stay out of the accessibility tree', () => {
    // Arrange, Act
    const { container } = render(<Icon name="github" />);

    // Assert
    const svg = container.querySelector('svg.icon');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(svg?.querySelector('use')?.getAttribute('href')).toBe('#icon-github');
  });
});
