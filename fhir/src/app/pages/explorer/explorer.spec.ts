import { TestBed } from '@angular/core/testing';
import { Explorer } from './explorer';
import { createSiteTestServices } from '../../../testing/site-testing';

describe('Explorer', () => {
  it('should render the explorer in the one section and link the about line to the site', async () => {
    // Arrange
    const services = createSiteTestServices();
    await TestBed.configureTestingModule({ imports: [Explorer], providers: services.providers }).compileComponents();
    const fixture = TestBed.createComponent(Explorer);

    // Act
    await fixture.whenStable();

    // Assert
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('section#explorer .fhir-explorer')).not.toBeNull();
    expect(host.querySelector('h1.fhir-title')?.textContent).toBe('FHIR R4 patient explorer');
    expect(host.querySelector('.explorer-about a')?.getAttribute('href')).toBe('https://site.example.test/');
    expect(services.fhir.capabilityCalls).toBe(1);
  });

  it('should start the engagement tracker after render and stop it on destroy', async () => {
    // Arrange
    const services = createSiteTestServices();
    await TestBed.configureTestingModule({ imports: [Explorer], providers: services.providers }).compileComponents();
    const fixture = TestBed.createComponent(Explorer);

    // Act
    await fixture.whenStable();
    const startsAfterRender = services.engagement.starts;
    fixture.destroy();

    // Assert
    expect(startsAfterRender).toBe(1);
    expect(services.engagement.stops).toBe(1);
  });
});
