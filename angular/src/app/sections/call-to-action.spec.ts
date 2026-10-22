import { TestBed } from '@angular/core/testing';
import { ServicesSection } from './services-section/services-section';
import { createSiteTestServices } from '../../testing/site-testing';

describe('call to action', () => {
  describe('ServicesSection', () => {
    it('should select the job topic when "Talk about a role" is clicked', async () => {
      // Arrange
      const services = createSiteTestServices();
      const selected: string[] = [];
      services.topics.topics.subscribe((topic) => selected.push(topic));
      await TestBed.configureTestingModule({ imports: [ServicesSection], providers: services.providers }).compileComponents();
      const fixture = TestBed.createComponent(ServicesSection);
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;

      // Act
      host.querySelector<HTMLAnchorElement>('a.button-primary[href="#contact"]')?.click();

      // Assert
      expect(selected).toEqual(['Job opportunity']);
      expect(host.querySelectorAll('.service-card').length).toBe(6);
      expect(host.querySelectorAll('.service-icon svg use').length).toBe(6);
    });
  });
});
