/** A skill aggregated across positions, from GET /api/skills. */
export interface Skill {
  /** Skill name as shown on the chip. */
  readonly name: string;

  /** How many positions list it. */
  readonly positionCount: number;

  /** Identifiers of those positions. */
  readonly positionIds: readonly string[];
}
