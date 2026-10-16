import { createSiteTestServices, renderWithSite } from '../../testing/site-testing';
import { Home } from './Home';

describe('Home', () => {
  it('should render every section in page order', () => {
    // Arrange, Act
    renderWithSite(<Home />);

    // Assert
    const ids = Array.from(document.querySelectorAll('section')).map(
      (section) => section.id || section.className,
    );
    expect(ids).toEqual([
      'hero',
      'about',
      'quote-band',
      'services',
      'freelance',
      'portfolio',
      'resume',
      'contact',
      'colophon',
    ]);
  });

  it('should start the engagement tracker once rendered and stop it on unmount', () => {
    // Arrange
    const services = createSiteTestServices();

    // Act
    const { unmount } = renderWithSite(<Home />, services);

    // Assert
    expect(services.engagement.starts).toBe(1);
    expect(services.engagement.stops).toBe(0);
    unmount();
    expect(services.engagement.stops).toBe(1);
  });
});
