import { ResourceSupport } from './resource-support';
import { Software } from './software';

/** The part of the sandbox CapabilityStatement the explorer depends on, from GET /api/fhir/capability. */
export interface CapabilitySubset {
  /** True when every required resource and search parameter is supported. */
  readonly ok: boolean;

  readonly fhirVersion: string;
  readonly software?: Software;
  readonly baseUrl: string;

  /** ISO 8601 date-time the statement was read. */
  readonly checkedAt: string;

  readonly resources: readonly ResourceSupport[];
}
