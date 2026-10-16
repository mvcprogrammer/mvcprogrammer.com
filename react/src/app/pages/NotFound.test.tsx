import { render } from '@testing-library/react';
import { NotFound } from './NotFound';

describe('NotFound', () => {
  it('should say the page is missing and link home', () => {
    // Arrange, Act
    const { container } = render(<NotFound />);

    // Assert
    expect(container.querySelector('h1')?.textContent).toBe('Page not found');
    expect(container.querySelector('.eyebrow')?.textContent).toBe('404');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});
