import { TestBed } from '@angular/core/testing';
import { Home } from './home';
import { createSiteTestServices } from '../../../testing/site-testing';

describe('Home', () => {
  it('should render every section in the nav order', async () => {
    // Arrange
    const services = createSiteTestServices();
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: services.providers,
    }).compileComponents();
    const fixture = TestBed.createComponent(Home);

    // Act
    await fixture.whenStable();

    // Assert
    const host = fixture.nativeElement as HTMLElement;
    const ids = Array.from(host.querySelectorAll('section[id]')).map((section) => section.id);
    expect(ids).toEqual([
      'about',
      'services',
      'portfolio',
      'resume',
      'contact',
      'colophon',
    ]);
    expect(host.querySelector('.hero')).not.toBeNull();
    expect(host.querySelector('.quote-band')).not.toBeNull();
    expect(host.querySelector('#kiosk-dialog')).not.toBeNull();
    expect(services.experience.experienceCalls).toEqual([null]);
  });

  it('should start the engagement tracker after render and stop it on destroy', async () => {
    // Arrange
    const services = createSiteTestServices();
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: services.providers,
    }).compileComponents();
    const fixture = TestBed.createComponent(Home);

    // Act
    await fixture.whenStable();
    const startsAfterRender = services.engagement.starts;
    fixture.destroy();

    // Assert
    expect(startsAfterRender).toBe(1);
    expect(services.engagement.stops).toBe(1);
  });
});
