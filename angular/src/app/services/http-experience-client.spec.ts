import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SITE_OPTIONS } from '../configurations/site-options';
import { HttpExperienceClient } from './http-experience-client';
import { TEST_SITE_OPTIONS } from '../../testing/site-testing';
import { createPosition, createPositionList, createSkillList } from '../../testing/test-data';

describe('HttpExperienceClient', () => {
  let client: HttpExperienceClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SITE_OPTIONS, useValue: TEST_SITE_OPTIONS }, HttpExperienceClient],
    });
    client = TestBed.inject(HttpExperienceClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getExperience', () => {
    it('should request the collection with a timeout and deserialize it', async () => {
      // Arrange
      const list = createPositionList();

      // Act
      const pending = client.getExperience(null);
      const request = http.expectOne('api/experience');
      request.flush(list);

      // Assert
      expect(request.request.method).toBe('GET');
      expect(request.request.timeout).toBe(HttpExperienceClient.TIMEOUT_MS);
      await expect(pending).resolves.toEqual(list);
    });

    it('should escape the skill in the query string', async () => {
      // Act
      const pending = client.getExperience('C#');
      http.expectOne('api/experience?skill=C%23').flush(createPositionList());

      // Assert
      await expect(pending).resolves.toBeTruthy();
    });

    it('should ignore a blank skill', async () => {
      // Act
      const pending = client.getExperience('   ');
      http.expectOne('api/experience').flush(createPositionList());

      // Assert
      await expect(pending).resolves.toBeTruthy();
    });

    it('should reject with an HttpErrorResponse on an error status', async () => {
      // Act
      const pending = client.getExperience(null);
      http.expectOne('api/experience').flush({ title: 'Service Unavailable' }, { status: 503, statusText: 'Service Unavailable' });

      // Assert
      await expect(pending).rejects.toMatchObject({ status: 503 });
    });

    it('should return an empty list for a null body', async () => {
      // Act
      const pending = client.getExperience(null);
      http.expectOne('api/experience').flush(null);

      // Assert
      await expect(pending).resolves.toEqual({ count: 0, items: [] });
    });
  });

  describe('getSkills', () => {
    it('should request the skills and deserialize them', async () => {
      // Arrange
      const skills = createSkillList('C#', 'Angular');

      // Act
      const pending = client.getSkills();
      const request = http.expectOne('api/skills');
      request.flush(skills);

      // Assert
      expect(request.request.timeout).toBe(HttpExperienceClient.TIMEOUT_MS);
      await expect(pending).resolves.toEqual(skills);
    });

    it('should return an empty list for a null body', async () => {
      // Act
      const pending = client.getSkills();
      http.expectOne('api/skills').flush(null);

      // Assert
      await expect(pending).resolves.toEqual({ count: 0, items: [] });
    });
  });

  describe('getSeed', () => {
    it('should request the seed path and deserialize the array', async () => {
      // Arrange
      const seed = [createPosition()];

      // Act
      const pending = client.getSeed();
      http.expectOne('data/positions.json').flush(seed);

      // Assert
      await expect(pending).resolves.toEqual(seed);
    });

    it('should return an empty array for a null body', async () => {
      // Act
      const pending = client.getSeed();
      http.expectOne('data/positions.json').flush(null);

      // Assert
      await expect(pending).resolves.toEqual([]);
    });
  });
});
