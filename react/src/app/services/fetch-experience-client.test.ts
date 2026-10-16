import { HttpStatusError } from '../exceptions/http-status-error';
import { createPositionList, createSkillList } from '../../testing/test-data';
import { jsonResponse, TEST_SITE_OPTIONS } from '../../testing/site-testing';
import { FetchExperienceClient } from './fetch-experience-client';

describe('FetchExperienceClient', () => {
  describe('getExperience', () => {
    it('should GET the experience path with the JSON Accept header and a timeout signal', async () => {
      // Arrange
      const list = createPositionList();
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(200, list));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const result = await client.getExperience(null);

      // Assert
      expect(result).toEqual(list);
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe('api/experience');
      expect(init?.headers).toEqual({ Accept: 'application/json' });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('should escape the skill in the query string', async () => {
      // Arrange
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(jsonResponse(200, createPositionList()));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act
      await client.getExperience('C# / .NET');

      // Assert
      expect(fetch.mock.calls[0]![0]).toBe('api/experience?skill=C%23%20%2F%20.NET');
    });

    it('should ignore a blank skill', async () => {
      // Arrange
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(jsonResponse(200, createPositionList()));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act
      await client.getExperience('   ');

      // Assert
      expect(fetch.mock.calls[0]![0]).toBe('api/experience');
    });

    it('should reject with HttpStatusError carrying the status on a non-2xx response', async () => {
      // Arrange
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(jsonResponse(503, { title: 'down' }));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const promise = client.getExperience(null);

      // Assert
      await expect(promise).rejects.toMatchObject({ name: 'HttpStatusError', status: 503 });
      await expect(promise).rejects.toBeInstanceOf(HttpStatusError);
    });

    it('should reject when the body is not JSON, as when a dev server answers with HTML', async () => {
      // Arrange
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(jsonResponse(200, null, { invalidJson: true }));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.getExperience(null)).rejects.toBeInstanceOf(SyntaxError);
    });

    it('should return an empty list for a null body', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(200, null));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const result = await client.getExperience(null);

      // Assert
      expect(result).toEqual({ count: 0, items: [] });
    });

    it('should propagate a rejected fetch, such as a timeout', async () => {
      // Arrange
      const timeout = new DOMException('The operation timed out.', 'TimeoutError');
      const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(timeout);
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act, Assert
      await expect(client.getExperience(null)).rejects.toBe(timeout);
    });
  });

  describe('getSkills', () => {
    it('should GET the skills path and return the list', async () => {
      // Arrange
      const list = createSkillList('C#', 'React');
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(200, list));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const result = await client.getSkills();

      // Assert
      expect(result).toEqual(list);
      expect(fetch.mock.calls[0]![0]).toBe('api/skills');
    });

    it('should return an empty list for a null body', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(200, null));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const result = await client.getSkills();

      // Assert
      expect(result).toEqual({ count: 0, items: [] });
    });
  });

  describe('getSeed', () => {
    it('should GET the seed path and return the positions', async () => {
      // Arrange
      const seed = createPositionList().items;
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(200, seed));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const result = await client.getSeed();

      // Assert
      expect(result).toEqual(seed);
      expect(fetch.mock.calls[0]![0]).toBe('data/positions.json');
    });

    it('should return an empty array for a null body', async () => {
      // Arrange
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(200, null));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS, fetch);

      // Act
      const result = await client.getSeed();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('constructor', () => {
    it('should use the global fetch when none is given', async () => {
      // Arrange
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse(200, createSkillList('C#')));
      const client = new FetchExperienceClient(TEST_SITE_OPTIONS);

      // Act
      await client.getSkills();

      // Assert
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });
});
