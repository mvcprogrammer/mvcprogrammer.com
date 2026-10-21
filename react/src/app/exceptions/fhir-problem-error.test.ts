import { FhirProblemError } from './fhir-problem-error';

describe('FhirProblemError', () => {
  describe('constructor', () => {
    it('should expose the status, title, timing, cache, and timeout facts and name itself', () => {
      // Act
      const error = new FhirProblemError('Nope.', 429, 'Too Many Requests', 12, 'Miss from cloudfront', false);

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FhirProblemError');
      expect(error.message).toBe('Nope.');
      expect(error.status).toBe(429);
      expect(error.title).toBe('Too Many Requests');
      expect(error.durationMs).toBe(12);
      expect(error.xCache).toBe('Miss from cloudfront');
      expect(error.timedOut).toBe(false);
      expect(error.upstreamFailed).toBe(false);
    });
  });

  describe('upstreamFailed', () => {
    it('should be true for 502 and 504 only', () => {
      // Assert
      expect(new FhirProblemError('x', 502, null, 0, null, false).upstreamFailed).toBe(true);
      expect(new FhirProblemError('x', 504, null, 0, null, false).upstreamFailed).toBe(true);
      expect(new FhirProblemError('x', 500, null, 0, null, false).upstreamFailed).toBe(false);
    });
  });

  describe('fromResponse', () => {
    it('should prefer the problem detail over the status message and keep the title and cache', () => {
      // Act
      const error = FhirProblemError.fromResponse(400, { title: 'Bad Request', detail: 'family is required' }, 20, 'Error from cloudfront');

      // Assert
      expect(error.status).toBe(400);
      expect(error.title).toBe('Bad Request');
      expect(error.message).toBe('family is required');
      expect(error.xCache).toBe('Error from cloudfront');
      expect(error.durationMs).toBe(20);
    });

    it('should use the status message when the body is not a problem', () => {
      // Act
      const upstream = FhirProblemError.fromResponse(504, null, 0, null);
      const limited = FhirProblemError.fromResponse(429, { title: 'Too Many Requests' }, 0, null);
      const other = FhirProblemError.fromResponse(500, null, 0, null);

      // Assert
      expect(upstream.message).toBe(FhirProblemError.UPSTREAM_MESSAGE);
      expect(upstream.title).toBeNull();
      expect(limited.message).toBe(FhirProblemError.RATE_LIMIT_MESSAGE);
      expect(limited.title).toBe('Too Many Requests');
      expect(other.message).toBe('The request failed (500).');
    });
  });

  describe('fromRejection', () => {
    it('should recognise the fetch timeout', () => {
      // Act
      const error = FhirProblemError.fromRejection(new DOMException('slow', 'TimeoutError'), 32_001);

      // Assert
      expect(error.status).toBe(0);
      expect(error.timedOut).toBe(true);
      expect(error.message).toBe(FhirProblemError.TIMEOUT_MESSAGE);
      expect(error.durationMs).toBe(32_001);
    });

    it('should treat anything else as a network failure', () => {
      // Act
      const error = FhirProblemError.fromRejection(new TypeError('Failed to fetch'), 5);

      // Assert
      expect(error.status).toBe(0);
      expect(error.timedOut).toBe(false);
      expect(error.message).toBe(FhirProblemError.NETWORK_MESSAGE);
    });

    it('should pass a FhirProblemError through unchanged', () => {
      // Arrange
      const original = new FhirProblemError('x', 404, null, 1, null, false);

      // Act, Assert
      expect(FhirProblemError.fromRejection(original, 99)).toBe(original);
    });
  });

  describe('notJson', () => {
    it('should carry the success status with the not-JSON message', () => {
      // Act
      const error = FhirProblemError.notJson(200, 7, null);

      // Assert
      expect(error.status).toBe(200);
      expect(error.message).toBe(FhirProblemError.NOT_JSON_MESSAGE);
    });
  });
});
