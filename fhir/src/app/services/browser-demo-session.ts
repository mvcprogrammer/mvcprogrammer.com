import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { DemoSession } from '../interfaces/demo-session';

/**
 * The session token lives in localStorage, so it stays with the browser from one visit to the next
 * and a closed tab does not orphan the patients the visitor created (until 2026-11-04 it lived in
 * sessionStorage and died with the tab, which left patients on the sandbox nobody could delete).
 * Storage is per origin and per browser profile, so it is never shared between visitors. Where
 * storage is blocked, the token lasts for the page only.
 */
@Injectable()
export class BrowserDemoSession extends DemoSession {
  /** The localStorage key. */
  static readonly STORAGE_KEY = 'fhir-demo-session';

  private readonly document = inject(DOCUMENT);

  /** @inheritdoc */
  override readonly token = this.load();

  /** @inheritdoc */
  override newKey(): string {
    return BrowserDemoSession.uuid(this.document.defaultView);
  }

  private load(): string {
    const window = this.document.defaultView;
    try {
      const saved = window?.localStorage.getItem(BrowserDemoSession.STORAGE_KEY);
      if (saved !== null && saved !== undefined && /^[0-9a-f-]{36}$/.test(saved)) {
        return saved;
      }

      const token = BrowserDemoSession.uuid(window);
      window?.localStorage.setItem(BrowserDemoSession.STORAGE_KEY, token);
      return token;
    } catch {
      return BrowserDemoSession.uuid(window);
    }
  }

  /** crypto.randomUUID where it exists; a v4 built from getRandomValues elsewhere, so the shape the function requires always holds. */
  private static uuid(window: Window | null): string {
    const crypto = window?.crypto;
    if (crypto !== undefined && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    if (crypto !== undefined) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
