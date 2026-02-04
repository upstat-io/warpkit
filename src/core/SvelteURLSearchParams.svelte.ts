/**
 * SvelteURLSearchParams
 *
 * URLSearchParams wrapper with Svelte 5 $state reactivity.
 * Changes to params trigger reactive updates in components.
 */

/**
 * Reactive URLSearchParams wrapper using Svelte 5 $state.
 * All mutations trigger reactive updates.
 */
export class SvelteURLSearchParams {
	#params = $state<URLSearchParams>(new URLSearchParams());

	constructor(init?: URLSearchParams | string) {
		if (init) {
			this.#params = new URLSearchParams(init);
		}
	}

	/** Get a param value by key. */
	get(key: string): string | null {
		return this.#params.get(key);
	}

	/** Get all values for a key. */
	getAll(key: string): string[] {
		return this.#params.getAll(key);
	}

	/** Check if a key exists. */
	has(key: string): boolean {
		return this.#params.has(key);
	}

	/** Set a param value. Triggers Svelte reactivity. */
	set(key: string, value: string): void {
		this.#params.set(key, value);
		// Trigger reactivity by reassigning
		this.#params = new URLSearchParams(this.#params);
	}

	/** Append a value to a key. Triggers Svelte reactivity. */
	append(key: string, value: string): void {
		this.#params.append(key, value);
		this.#params = new URLSearchParams(this.#params);
	}

	/** Delete all values for a key. Triggers Svelte reactivity. */
	delete(key: string): void {
		this.#params.delete(key);
		this.#params = new URLSearchParams(this.#params);
	}

	toString(): string {
		return this.#params.toString();
	}

	entries(): IterableIterator<[string, string]> {
		return this.#params.entries();
	}

	keys(): IterableIterator<string> {
		return this.#params.keys();
	}

	values(): IterableIterator<string> {
		return this.#params.values();
	}

	forEach(callback: (value: string, key: string) => void): void {
		this.#params.forEach(callback);
	}

	/**
	 * Replace all params with new values.
	 * Used internally for atomic updates.
	 */
	replaceAll(init: URLSearchParams | string): void {
		this.#params = new URLSearchParams(init);
	}

	/**
	 * Get the underlying size (number of params).
	 */
	get size(): number {
		return this.#params.size;
	}

	/**
	 * Support for...of iteration.
	 */
	[Symbol.iterator](): IterableIterator<[string, string]> {
		return this.#params[Symbol.iterator]();
	}
}
