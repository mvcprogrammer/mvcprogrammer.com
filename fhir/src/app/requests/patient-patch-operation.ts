/** The paths a patch may touch: the properties of PatientInput. */
export type PatientPatchPath = '/familyName' | '/givenName' | '/sex' | '/birthDate' | '/mrn';

/** One RFC 6902 operation against the PatientInput view of a patient. Mirrors an item of PatientPatch in openapi.yaml. */
export interface PatientPatchOperation {
  readonly op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  readonly path: PatientPatchPath;
  readonly from?: PatientPatchPath;
  readonly value?: string;
}
