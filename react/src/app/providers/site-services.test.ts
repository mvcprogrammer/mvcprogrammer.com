import { BeaconEngagementTracker } from '../services/beacon-engagement-tracker';
import { FetchContactClient } from '../services/fetch-contact-client';
import { FetchExperienceClient } from '../services/fetch-experience-client';
import { FetchFhirClient } from '../services/fetch-fhir-client';
import { ListenerContactTopicState } from '../services/listener-contact-topic-state';
import { TEST_SITE_OPTIONS } from '../../testing/site-testing';
import { createSiteServices, validateSiteOptions } from './site-services';

describe('createSiteServices', () => {
  it('should build every service over the given options', () => {
    // Arrange, Act
    const services = createSiteServices(TEST_SITE_OPTIONS);

    // Assert
    expect(services.options).toBe(TEST_SITE_OPTIONS);
    expect(services.experience).toBeInstanceOf(FetchExperienceClient);
    expect(services.fhir).toBeInstanceOf(FetchFhirClient);
    expect(services.contact).toBeInstanceOf(FetchContactClient);
    expect(services.topics).toBeInstanceOf(ListenerContactTopicState);
    expect(services.engagement).toBeInstanceOf(BeaconEngagementTracker);
  });

  it('should reject invalid options before building anything', () => {
    // Arrange
    const options = { ...TEST_SITE_OPTIONS, resumeUrl: '' };

    // Act, Assert
    expect(() => createSiteServices(options)).toThrow(
      'Invalid site options: resumeUrl is required.',
    );
  });
});

describe('validateSiteOptions', () => {
  it('should accept complete options', () => {
    // Arrange, Act, Assert
    expect(() => validateSiteOptions(TEST_SITE_OPTIONS)).not.toThrow();
  });

  it.each([
    'contactEndpoint',
    'experienceApiBase',
    'experienceSeedPath',
    'fhirApiBase',
    'kioskUrl',
    'resumeUrl',
  ] as const)('should require %s', (key) => {
    // Arrange
    const options = { ...TEST_SITE_OPTIONS, [key]: '  ' };

    // Act, Assert
    expect(() => validateSiteOptions(options)).toThrow(`Invalid site options: ${key} is required.`);
  });

  it.each(['contactEndpoint', 'kioskUrl', 'resumeUrl'] as const)(
    'should require %s to be an absolute URL',
    (key) => {
      // Arrange
      const options = { ...TEST_SITE_OPTIONS, [key]: 'not a url' };

      // Act, Assert
      expect(() => validateSiteOptions(options)).toThrow(
        `Invalid site options: ${key} must be an absolute URL.`,
      );
    },
  );

  it('should name every problem at once', () => {
    // Arrange
    const options = { ...TEST_SITE_OPTIONS, contactEndpoint: '', kioskUrl: 'nope' };

    // Act, Assert
    expect(() => validateSiteOptions(options)).toThrow(
      'Invalid site options: contactEndpoint is required; kioskUrl must be an absolute URL.',
    );
  });
});
