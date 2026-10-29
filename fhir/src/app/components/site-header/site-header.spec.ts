import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SiteHeader } from './site-header';
import { createSiteTestServices } from '../../../testing/site-testing';

describe('SiteHeader', () => {
  let fixture: ComponentFixture<SiteHeader>;
  let host: HTMLElement;

  beforeEach(async () => {
    const services = createSiteTestServices();
    await TestBed.configureTestingModule({ imports: [SiteHeader], providers: services.providers }).compileComponents();
    fixture = TestBed.createComponent(SiteHeader);
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  it('should link the brand to the main site and the about link to its FHIR card', () => {
    // Assert
    expect(host.querySelector('a.brand')?.getAttribute('href')).toBe('https://site.example.test/');
    expect(host.querySelector('.header-links a.nav-link')?.getAttribute('href')).toBe('https://site.example.test/#fhir-api');
    expect(host.querySelector('nav')).toBeNull();
    expect(host.querySelector('.edition')).toBeNull();
  });

  it('should flip the theme and remember the choice', () => {
    // Arrange
    const toggle = host.querySelector('button.theme-toggle') as HTMLButtonElement;

    // Act
    toggle.click();
    const first = document.documentElement.getAttribute('data-theme');
    toggle.click();
    const second = document.documentElement.getAttribute('data-theme');

    // Assert
    expect(['light', 'dark']).toContain(first);
    expect(second).not.toBe(first);
    expect(localStorage.getItem('theme')).toBe(second);
  });
});
