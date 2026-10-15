import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { SITE_OPTIONS } from '../configurations/site-options';
import { ContactClient } from '../interfaces/contact-client';
import { ContactTopicState } from '../interfaces/contact-topic-state';
import { ExperienceClient } from '../interfaces/experience-client';
import { HttpContactClient } from '../services/http-contact-client';
import { HttpExperienceClient } from '../services/http-experience-client';
import { SubjectContactTopicState } from '../services/subject-contact-topic-state';
import { provideSite, validateSiteOptions } from './site-providers';
import { TEST_SITE_OPTIONS } from '../../testing/site-testing';

describe('provideSite', () => {
  it('should register the options, HttpClient, both clients, and the topic state', () => {
    // Arrange
    TestBed.configureTestingModule({ providers: [provideSite(TEST_SITE_OPTIONS)] });

    // Act
    const options = TestBed.inject(SITE_OPTIONS);
    const experience = TestBed.inject(ExperienceClient);
    const contact = TestBed.inject(ContactClient);
    const topics = TestBed.inject(ContactTopicState);

    // Assert
    expect(options).toBe(TEST_SITE_OPTIONS);
    expect(TestBed.inject(HttpClient)).toBeInstanceOf(HttpClient);
    expect(experience).toBeInstanceOf(HttpExperienceClient);
    expect(contact).toBeInstanceOf(HttpContactClient);
    expect(topics).toBeInstanceOf(SubjectContactTopicState);
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
    expect(() => provideSite({ ...TEST_SITE_OPTIONS, resumeUrl: '' })).toThrowError(/resumeUrl is required/);
  });
});

describe('validateSiteOptions', () => {
  it('should accept the production-shaped options', () => {
    // Act and Assert
    expect(() => validateSiteOptions(TEST_SITE_OPTIONS)).not.toThrow();
  });

  it('should name every blank option', () => {
    // Act and Assert
    expect(() => validateSiteOptions({ ...TEST_SITE_OPTIONS, experienceApiBase: ' ', kioskUrl: '' })).toThrowError(
      'Invalid site options: experienceApiBase is required; kioskUrl is required.',
    );
  });

  it('should reject a relative value for a URL option', () => {
    // Act and Assert
    expect(() => validateSiteOptions({ ...TEST_SITE_OPTIONS, contactEndpoint: 'contact' })).toThrowError(/contactEndpoint must be an absolute URL/);
  });
});
