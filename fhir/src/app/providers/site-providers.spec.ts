import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { SITE_OPTIONS } from '../configurations/site-options';
import { DemoSession } from '../interfaces/demo-session';
import { EngagementTracker } from '../interfaces/engagement-tracker';
import { FhirClient } from '../interfaces/fhir-client';
import { BeaconEngagementTracker } from '../services/beacon-engagement-tracker';
import { BrowserDemoSession } from '../services/browser-demo-session';
import { HttpFhirClient } from '../services/http-fhir-client';
import { provideSite, validateSiteOptions } from './site-providers';
import { TEST_SITE_OPTIONS } from '../../testing/site-testing';

describe('provideSite', () => {
  it('should register the options, HttpClient, the session, the FHIR client, and the tracker', () => {
    // Arrange
    TestBed.configureTestingModule({ providers: [provideSite(TEST_SITE_OPTIONS)] });

    // Act
    const options = TestBed.inject(SITE_OPTIONS);
    const http = TestBed.inject(HttpClient);
    const fhir = TestBed.inject(FhirClient);
    const session = TestBed.inject(DemoSession);
    const tracker = TestBed.inject(EngagementTracker);

    // Assert
    expect(options).toBe(TEST_SITE_OPTIONS);
    expect(http).toBeInstanceOf(HttpClient);
    expect(fhir).toBeInstanceOf(HttpFhirClient);
    expect(session).toBeInstanceOf(BrowserDemoSession);
    expect(tracker).toBeInstanceOf(BeaconEngagementTracker);
  });

  it('should throw at registration when an option is invalid', () => {
    // Arrange
    const options = { ...TEST_SITE_OPTIONS, siteUrl: 'not a url' };

    // Act
    const act = (): unknown => provideSite(options);

    // Assert
    expect(act).toThrowError('Invalid site options: siteUrl must be an absolute URL.');
  });
});

describe('validateSiteOptions', () => {
  it('should accept the test options', () => {
    // Act
    const act = (): void => validateSiteOptions(TEST_SITE_OPTIONS);

    // Assert
    expect(act).not.toThrow();
  });

  it('should name every blank option', () => {
    // Arrange
    const options = { fhirApiBase: ' ', siteUrl: '' };

    // Act
    const act = (): void => validateSiteOptions(options);

    // Assert
    expect(act).toThrowError('Invalid site options: fhirApiBase is required; siteUrl is required.');
  });
});
