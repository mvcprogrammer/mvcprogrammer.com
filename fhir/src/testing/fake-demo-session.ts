import { DemoSession } from '../app/interfaces/demo-session';

/** A fixed session token and predictable idempotency keys. */
export class FakeDemoSession extends DemoSession {
  static readonly TOKEN = '6f1d2c3b-9a8e-4b7c-9d6e-5f4a3b2c1d0e';

  /** Keys handed out so far, in order. */
  readonly keys: string[] = [];

  override readonly token = FakeDemoSession.TOKEN;

  override newKey(): string {
    const key = `0c9b8a7d-6e5f-4a3b-8c2d-${(this.keys.length + 1).toString(16).padStart(12, '0')}`;
    this.keys.push(key);
    return key;
  }
}
