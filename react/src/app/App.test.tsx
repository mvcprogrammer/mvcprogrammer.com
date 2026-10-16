import { render } from '@testing-library/react';
import { createSiteTestServices, renderWithSite } from '../testing/site-testing';
import { App, Layout } from './App';

describe('Layout', () => {
  it('should wrap the routed page in the skip link, sprite, header, main, and footer', () => {
    // Arrange, Act
    renderWithSite(<Layout />);

    // Assert
    const children = Array.from(document.querySelector('#root, body > div')!.children).map(
      (child) => child.tagName.toLowerCase() + (child.id ? `#${child.id}` : ''),
    );
    expect(children).toEqual(['a', 'svg', 'header', 'main#main', 'footer']);
    expect(document.querySelector('.skip-link')?.getAttribute('href')).toBe('#main');
    expect(document.querySelector('main')?.getAttribute('tabindex')).toBe('-1');
    expect(document.querySelector('main section.hero')).not.toBeNull();
  });

  it('should route an unknown path to the not-found page', () => {
    // Arrange, Act
    renderWithSite(<Layout />, createSiteTestServices(), '/no-such-page');

    // Assert
    expect(document.querySelector('main h1')?.textContent).toBe('Page not found');
    expect(document.querySelector('section.hero')).toBeNull();
  });
});

describe('App', () => {
  it('should render the home page under the browser router with the given services', () => {
    // Arrange
    const services = createSiteTestServices();

    // Act
    render(<App services={services} />);

    // Assert
    expect(document.querySelector('main section.hero')).not.toBeNull();
    expect(services.engagement.starts).toBe(1);
  });
});
