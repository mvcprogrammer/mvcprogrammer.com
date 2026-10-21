import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { SITE_OPTIONS } from '../configurations/site-options';
import { ContactClient } from '../interfaces/contact-client';
import { ContactTopicState } from '../interfaces/contact-topic-state';
import { EngagementTracker } from '../interfaces/engagement-tracker';
import { ExperienceClient } from '../interfaces/experience-client';
import { FhirClient } from '../interfaces/fhir-client';
import { BeaconEngagementTracker } from '../services/beacon-engagement-tracker';
import { HttpContactClient } from '../services/http-contact-client';
import { HttpExperienceClient } from '../services/http-experience-client';
import { HttpFhirClient } from '../services/http-fhir-client';
import { SubjectContactTopicState } from '../services/subject-contact-topic-state';
import { provideSite, validateSiteOptions } from './site-providers';
import { TEST_SITE_OPTIONS } from '../../testing/site-testing';

describe('provideSite', () => {
  it('should register the options, HttpClient, the three clients, the topic state, and the tracker', () => {
    // Arrange
    TestBed.configureTestingModule({ providers: [provideSite(TEST_SITE_OPTIONS)] });

    // Act
    const options = TestBed.inject(SITE_OPTIONS);
    const experience = TestBed.inject(ExperienceClient);
    const fhir = TestBed.inject(FhirClient);
    const contact = TestBed.inject(ContactClient);
    const topics = TestBed.inject(ContactTopicState);
    const tracker = TestBed.inject(EngagementTracker);

    // Assert
    expect(options).toBe(TEST_SITE_OPTIONS);
    expect(TestBed.inject(HttpClient)).toBeInstanceOf(HttpClient);
    expect(experience).toBeInstanceOf(HttpExperienceClient);
    expect(fhir).toBeInstanceOf(HttpFhirClient);
    expect(contact).toBeInstanceOf(HttpContactClient);
    expect(topics).toBeInstanceOf(SubjectContactTopicState);
    expect(tracker).toBeInstanceOf(BeaconEngagementTracker);
  });

  it('should hand out one topic state for the whole app', () => {
    // Arrange
    TestBed.configureTestingModule({ providers: [provideSite(TEST_SITE_OPTIONS)] });

    // Act
    const first = TestBed.inject(ContactTopicState);
    const second = TestBed.inject(ContactTopicState);

    // Assert
    expect(first).toBe(second);
  });

  it('should throw on invalid options before anything is provided', () => {
    // Act and Assert
    expect(() => provideSite({ ...TEST_SITE_OPTIONS, resumeUrl: '' })).toThrowError(
      /resumeUrl is required/,
    );
  });
});

describe('validateSiteOptions', () => {
  it('should accept the production-shaped options', () => {
    // Act and Assert
    expect(() => validateSiteOptions(TEST_SITE_OPTIONS)).not.toThrow();
  });

  it('should name every blank option', () => {
    // Act and Assert
    expect(() =>
      validateSiteOptions({ ...TEST_SITE_OPTIONS, experienceApiBase: ' ', fhirApiBase: '', kioskUrl: '' }),
    ).toThrowError('Invalid site options: experienceApiBase is required; fhirApiBase is required; kioskUrl is required.');
  });

  it('should reject a relative value for a URL option', () => {
    // Act and Assert
    expect(() =>
      validateSiteOptions({ ...TEST_SITE_OPTIONS, contactEndpoint: 'contact' }),
    ).toThrowError(/contactEndpoint must be an absolute URL/);
  });
});
