import { TestBed } from '@angular/core/testing';
import { NotFound } from './not-found';

describe('NotFound', () => {
  it('should say the page is missing and link home', async () => {
    // Arrange
    const fixture = TestBed.createComponent(NotFound);

    // Act
    await fixture.whenStable();

    // Assert
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toBe('Page not found');
    expect(host.querySelector('.section-intro a')?.getAttribute('href')).toBe('/');
  });
});
