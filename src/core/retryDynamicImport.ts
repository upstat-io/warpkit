/**
 * Retry wrapper for dynamic import() calls that may fail due to transient
 * server issues (e.g., Vite dev server restart returning 504).
 *
 * Retries up to 3 times with exponential backoff (100ms, 200ms, 400ms).
 * Only retries on transient network/fetch errors — module evaluation errors
 * (SyntaxError, ReferenceError, etc.) fail immediately.
 *
 * Combined with Section 04's navigate() retry (3 attempts), a single startup
 * could attempt up to 9 total imports. This is intentional defense-in-depth:
 * this utility handles brief blips (< 1 second), navigate retry handles
 * longer server restarts (1-3 seconds). Total window is bounded under 10s.
 */

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

/**
 * Check if an error is a transient dynamic import failure that may succeed on retry.
 *
 * Transient errors include:
 * - "Failed to fetch dynamically imported module" (Chrome/Firefox)
 * - TypeError with "fetch" in message (cross-browser network failures)
 * - "Load failed" (Safari)
 *
 * Non-retryable errors (module evaluation failures):
 * - SyntaxError, ReferenceError, RangeError, etc.
 */
function isTransientImportError(error: unknown): boolean {
	if (error instanceof SyntaxError) return false;
	if (error instanceof ReferenceError) return false;
	if (error instanceof RangeError) return false;

	if (error instanceof TypeError) {
		const msg = error.message.toLowerCase();
		return msg.includes('fetch') || msg.includes('load failed') || msg.includes('import');
	}

	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		return (
			msg.includes('failed to fetch dynamically imported module') ||
			msg.includes('load failed') ||
			msg.includes('loading chunk') ||
			msg.includes('loading css chunk')
		);
	}

	return false;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a dynamic import loader function with exponential backoff.
 *
 * @param loader - Function that performs the dynamic import (e.g., `() => import('./Foo.svelte')`)
 * @returns The resolved module
 * @throws The original error from the last attempt if all retries are exhausted
 */
export async function retryDynamicImport<T>(loader: () => Promise<T>): Promise<T> {
	let lastError: unknown;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			return await loader();
		} catch (error) {
			lastError = error;

			if (!isTransientImportError(error)) {
				throw error;
			}

			// Don't delay after the last attempt
			if (attempt < MAX_RETRIES - 1) {
				const backoff = BASE_DELAY_MS * 2 ** attempt; // 100, 200, 400
				await delay(backoff);
			}
		}
	}

	// All retries exhausted on a chunk load error — likely a new deployment
	// with different chunk hashes. Auto-reload to pick up the new index.html.
	// SessionStorage guard prevents infinite reload loops.
	if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
		const RELOAD_KEY = 'warpkit:chunk-reload';
		const reloadedAt = sessionStorage.getItem(RELOAD_KEY);
		const reloadAge = reloadedAt ? Date.now() - Number(reloadedAt) : Infinity;

		if (reloadAge > 10_000) {
			// Haven't reloaded recently — do it now
			sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
			window.location.reload();
			// Halt execution while reload happens
			await new Promise(() => {});
		}

		// Already reloaded within 10s — something else is wrong.
		// Clean up flag and throw so error surfaces.
		sessionStorage.removeItem(RELOAD_KEY);
	}

	throw lastError;
}
