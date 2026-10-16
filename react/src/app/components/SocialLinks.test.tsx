import { render } from '@testing-library/react';
import { SocialLinks } from './SocialLinks';

describe('SocialLinks', () => {
  it('should link the three profiles in new tabs with labels and icons', () => {
    // Arrange, Act
    const { container } = render(<SocialLinks />);

    // Assert
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a.social-link'));
    expect(links.map((a) => [a.getAttribute('aria-label'), a.getAttribute('href')])).toEqual([
      ['GitHub', 'https://github.com/mvcprogrammer'],
      ['LinkedIn', 'https://www.linkedin.com/in/mvcprogrammer/'],
      ['Flickr', 'https://www.flickr.com/photos/lightsplitters/'],
    ]);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer me');
      expect(link.querySelector('svg.icon use')).not.toBeNull();
    }
  });
});
