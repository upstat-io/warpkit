/**
 * In-Memory Auth Storage for Testing
 *
 * Map-backed implementation of AuthStorage that never touches localStorage.
 * Use in tests to prevent cross-test contamination with isolate: false.
 */

import type { AuthStorage } from '../auth/types';

/**
 * In-memory implementation of AuthStorage for testing.
 *
 * All operations are synchronous and backed by a Map.
 * No browser APIs are accessed.
 *
 * @example
 * ```typescript
 * const authStorage = new MemoryAuthStorage();
 *
 * const warpkit = new WarpKit({
 *   routes,
 *   initialState: 'unauthenticated',
 *   authAdapter,
 *   authStorage
 * });
 * ```
 */
export class MemoryAuthStorage implements AuthStorage {
	private store = new Map<string, string>();

	public getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	public setItem(key: string, value: string): void {
		this.store.set(key, value);
	}

	public removeItem(key: string): void {
		this.store.delete(key);
	}
}
