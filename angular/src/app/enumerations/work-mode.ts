/** Where the work happened. The API serialises it in kebab-case. */
export enum WorkMode {
  /** Fully remote. */
  Remote = 'remote',

  /** Part office, part remote. */
  Hybrid = 'hybrid',

  /** In the office; the position's location says where. */
  OnSite = 'on-site',
}
