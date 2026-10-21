/** Whether the sandbox supports one search parameter the explorer needs. */
export interface ParamSupport {
  readonly name: string;
  readonly supported: boolean;
}
