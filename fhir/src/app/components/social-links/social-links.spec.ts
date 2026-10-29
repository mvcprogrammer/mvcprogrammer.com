import { TestBed } from '@angular/core/testing';
import { SocialLinks } from './social-links';

describe('SocialLinks', () => {
  it('should render three external profile links with an icon each', async () => {
    // Arrange
    const fixture = TestBed.createComponent(SocialLinks);

    // Act
    await fixture.whenStable();

    // Assert
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.social-link'));
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual(['GitHub', 'LinkedIn', 'Flickr']);
    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.querySelector('svg use')).not.toBeNull();
    }
  });
});
