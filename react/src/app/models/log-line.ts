/** One line of the explorer's request log; the kind picks its colour. */
export interface LogLine {
  readonly text: string;
  readonly kind: 'request' | 'response' | 'upstream' | 'detail' | 'note' | 'error' | '';
}
