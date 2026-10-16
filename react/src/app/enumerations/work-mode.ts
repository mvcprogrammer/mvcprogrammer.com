/** Where the work happened. The API serialises it in kebab-case. */
export const WorkMode = {
  /** Fully remote. */
  Remote: 'remote',

  /** Part office, part remote. */
  Hybrid: 'hybrid',

  /** In the office; the position's location says where. */
  OnSite: 'on-site',
} as const;

/** One of the WorkMode values. */
export type WorkMode = (typeof WorkMode)[keyof typeof WorkMode];
