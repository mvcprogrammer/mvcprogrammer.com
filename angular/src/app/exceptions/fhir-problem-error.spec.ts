import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
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

  describe('from', () => {
    it('should treat anything but an HttpErrorResponse as a network failure', () => {
      // Act
      const error = FhirProblemError.from(new Error('boom'), 5);

      // Assert
      expect(error.status).toBe(0);
      expect(error.message).toBe(FhirProblemError.NETWORK_MESSAGE);
      expect(error.durationMs).toBe(5);
    });

    it('should recognise the fetch backend timeout', () => {
      // Arrange
      const response = new HttpErrorResponse({ status: 0, error: { name: 'TimeoutError' } });

      // Act
      const error = FhirProblemError.from(response, 32_001);

      // Assert
      expect(error.timedOut).toBe(true);
      expect(error.message).toBe(FhirProblemError.TIMEOUT_MESSAGE);
    });

    it('should prefer the problem detail over the status message', () => {
      // Arrange
      const response = new HttpErrorResponse({ status: 400, error: { title: 'Bad Request', detail: 'family is required' }, headers: new HttpHeaders({ 'x-cache': 'Error from cloudfront' }) });

      // Act
      const error = FhirProblemError.from(response, 20);

      // Assert
      expect(error.status).toBe(400);
      expect(error.title).toBe('Bad Request');
      expect(error.message).toBe('family is required');
      expect(error.xCache).toBe('Error from cloudfront');
    });

    it('should use the status message when the body is not a problem', () => {
      // Act
      const upstream = FhirProblemError.from(new HttpErrorResponse({ status: 504, error: 'gateway timeout' }), 0);
      const other = FhirProblemError.from(new HttpErrorResponse({ status: 500, error: null }), 0);

      // Assert
      expect(upstream.message).toBe(FhirProblemError.UPSTREAM_MESSAGE);
      expect(upstream.title).toBeNull();
      expect(other.message).toBe('The request failed (500).');
    });

    it('should call a success status with an unparseable body not JSON', () => {
      // Act
      const error = FhirProblemError.from(new HttpErrorResponse({ status: 200, error: new SyntaxError('Unexpected token <') }), 0);

      // Assert
      expect(error.status).toBe(200);
      expect(error.message).toBe(FhirProblemError.NOT_JSON_MESSAGE);
    });
  });
});
