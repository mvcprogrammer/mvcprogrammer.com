/** One `Patient.identifier`, kept so the summary can show the MRN with its system. */
export interface Identifier {
  readonly system?: string;
  readonly value: string;

  /** The identifier type code (`MR`, `SS`, `DL`, ...), when present. */
  readonly type?: string;
}
