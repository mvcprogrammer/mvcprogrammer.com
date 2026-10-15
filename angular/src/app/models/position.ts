import { WorkMode } from '../enumerations/work-mode';

/** One role at one organisation, as the Experience API returns it (see api/openapi.yaml). */
export interface Position {
  /** Stable identifier, e.g. "advancedmd". */
  readonly id: string;

  /** Job title. */
  readonly title: string;

  /** Employer or client. */
  readonly organization: string;

  /** ISO 8601 year-month, e.g. 2023-12. */
  readonly startDate: string;

  /** Year-month, or null while current. */
  readonly endDate: string | null;

  /** Remote, hybrid, or on-site. */
  readonly workMode: WorkMode;

  /** City or region for on-site roles. */
  readonly location: string;

  /** Bullet points shown on the timeline. */
  readonly highlights: readonly string[];

  /** Skill names used by the filter. */
  readonly skills: readonly string[];
}
