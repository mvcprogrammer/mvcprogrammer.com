import { fireEvent, screen } from '@testing-library/react';
import { createSiteTestServices, renderWithSite } from '../../testing/site-testing';
import { FreelanceSection } from './FreelanceSection';
import { ServicesSection } from './ServicesSection';

describe('calls to action', () => {
  it('should preselect the Job opportunity topic from the Services section', () => {
    // Arrange
    const services = createSiteTestServices();
    const listener = vi.fn();
    services.topics.subscribe(listener);
    renderWithSite(<ServicesSection />, services);

    // Act
    fireEvent.click(screen.getByText('Talk about a role'));

    // Assert
    expect(listener).toHaveBeenCalledWith('Job opportunity');
    expect(screen.getByText('Talk about a role').getAttribute('href')).toBe('#contact');
  });

  it('should preselect the Freelance topic from the Freelance section', () => {
    // Arrange
    const services = createSiteTestServices();
    const listener = vi.fn();
    services.topics.subscribe(listener);
    renderWithSite(<FreelanceSection />, services);

    // Act
    fireEvent.click(screen.getByText('Start a conversation'));

    // Assert
    expect(listener).toHaveBeenCalledWith('Freelance');
  });
});
