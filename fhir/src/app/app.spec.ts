import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { createSiteTestServices } from '../testing/site-testing';

describe('App', () => {
  it('should render the skip link, sprite, header, main, and footer around the explorer', async () => {
    // Arrange
    const services = createSiteTestServices();
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes), ...services.providers] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    // Act
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();

    // Assert
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('a.skip-link')?.getAttribute('href')).toBe('#main');
    expect(host.querySelector('symbol#icon-github')).not.toBeNull();
    expect(host.querySelector('header.site-header')).not.toBeNull();
    expect(host.querySelector('main#main')?.getAttribute('tabindex')).toBe('-1');
    expect(host.querySelector('main#main section#explorer .fhir-explorer')).not.toBeNull();
    expect(host.querySelector('footer.site-footer')).not.toBeNull();
    expect(services.fhir.capabilityCalls).toBe(1);
  });

  it('should route an unknown path to the not-found page', async () => {
    // Arrange
    const services = createSiteTestServices();
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes), ...services.providers] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    // Act
    await TestBed.inject(Router).navigateByUrl('/no-such-page');
    await fixture.whenStable();

    // Assert
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('main h1')?.textContent).toBe('Page not found');
    expect(host.querySelector('section#explorer')).toBeNull();
  });
});
