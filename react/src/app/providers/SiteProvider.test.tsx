import { render } from '@testing-library/react';
import { createSiteTestServices } from '../../testing/site-testing';
import { SiteProvider, useSite } from './SiteProvider';

/** Prints the configured resume URL, proving the services reached it. */
function Probe() {
  const { options } = useSite();
  return <p>{options.resumeUrl}</p>;
}

describe('SiteProvider', () => {
  it('should hand the services to components below it', () => {
    // Arrange
    const services = createSiteTestServices();

    // Act
    const { container } = render(
      <SiteProvider services={services}>
        <Probe />
      </SiteProvider>,
    );

    // Assert
    expect(container.textContent).toBe('https://resume.example.test/');
  });
});

describe('useSite', () => {
  it('should throw a clear error outside a SiteProvider', () => {
    // Arrange
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act, Assert
    expect(() => render(<Probe />)).toThrow('useSite() needs a SiteProvider above the component.');
    errors.mockRestore();
  });
});
