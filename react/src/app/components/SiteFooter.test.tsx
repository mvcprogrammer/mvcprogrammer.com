import { render } from '@testing-library/react';
import { SiteFooter } from './SiteFooter';

describe('SiteFooter', () => {
  it('should show the current year and link the legal pages on the static site', () => {
    // Arrange, Act
    const { container } = render(<SiteFooter />);

    // Assert
    expect(container.querySelector('.footer-copy')?.textContent).toBe(
      `© ${new Date().getFullYear()} mvcprogrammer.com`,
    );
    const legal = Array.from(container.querySelectorAll<HTMLAnchorElement>('.footer-links a')).map(
      (a) => [a.textContent, a.getAttribute('href')],
    );
    expect(legal).toEqual([
      ['Privacy', 'https://mvcprogrammer.com/privacy.html'],
      ['SMS terms', 'https://mvcprogrammer.com/terms.html'],
    ]);
    expect(container.querySelectorAll('.social-link').length).toBe(3);
  });
});
