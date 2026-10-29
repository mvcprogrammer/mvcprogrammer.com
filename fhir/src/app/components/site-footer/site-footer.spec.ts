import { TestBed } from '@angular/core/testing';
import { SiteFooter } from './site-footer';

describe('SiteFooter', () => {
  it('should show the current year and the legal links on the static site', async () => {
    // Arrange
    const fixture = TestBed.createComponent(SiteFooter);

    // Act
    await fixture.whenStable();

    // Assert
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.footer-copy')?.textContent).toContain(String(new Date().getFullYear()));
    const legal = Array.from(host.querySelectorAll<HTMLAnchorElement>('.footer-links a')).map((a) => a.getAttribute('href'));
    expect(legal).toEqual(['https://mvcprogrammer.com/privacy.html', 'https://mvcprogrammer.com/terms.html']);
    expect(host.querySelectorAll('.social-link').length).toBe(3);
  });
});
