/**
 * SvelteURLSearchParams
 *
 * URLSearchParams wrapper with Svelte 5 $state reactivity.
 * Changes to params trigger reactive updates in components.
 *
 * Uses a version counter to trigger reactivity without creating
 * new URLSearchParams objects on every mutation.
 */

/**
 * Reactive URLSearchParams wrapper using Svelte 5 $state.
 * All mutations trigger reactive updates via a version counter,
 * avoiding unnecessary object allocations.
 */
export class SvelteURLSearchParams {
	/** The underlying URLSearchParams (not reactive itself) */
	#params: URLSearchParams;

	/**
	 * Version counter to trigger Svelte reactivity.
	 * Reading methods check this to establish dependencies.
	 * Writing methods increment this to trigger updates.
	 */
	#version = $state<number>(0);

	constructor(init?: URLSearchParams | string) {
		this.#params = new URLSearchParams(init);
	}

	/** Get a param value by key. */
	get(key: string): string | null {
		// Read version to establish reactive dependency
		void this.#version;
		return this.#params.get(key);
	}

	/** Get all values for a key. */
	getAll(key: string): string[] {
		void this.#version;
		return this.#params.getAll(key);
	}

	/** Check if a key exists. */
	has(key: string): boolean {
		void this.#version;
		return this.#params.has(key);
	}

	/** Set a param value. Triggers Svelte reactivity. */
	set(key: string, value: string): void {
		this.#params.set(key, value);
		this.#version++;
	}

	/** Append a value to a key. Triggers Svelte reactivity. */
	append(key: string, value: string): void {
		this.#params.append(key, value);
		this.#version++;
	}

	/** Delete all values for a key. Triggers Svelte reactivity. */
	delete(key: string): void {
		this.#params.delete(key);
		this.#version++;
	}

	toString(): string {
		void this.#version;
		return this.#params.toString();
	}

	entries(): IterableIterator<[string, string]> {
		void this.#version;
		return this.#params.entries();
	}

	keys(): IterableIterator<string> {
		void this.#version;
		return this.#params.keys();
	}

	values(): IterableIterator<string> {
		void this.#version;
		return this.#params.values();
	}

	forEach(callback: (value: string, key: string) => void): void {
		void this.#version;
		this.#params.forEach(callback);
	}

	/**
	 * Replace all params with new values.
	 * Used internally for atomic updates.
	 */
	replaceAll(init: URLSearchParams | string): void {
		this.#params = new URLSearchParams(init);
		this.#version++;
	}

	/**
	 * Get the underlying size (number of params).
	 */
	get size(): number {
		void this.#version;
		return this.#params.size;
	}

	/**
	 * Support for...of iteration.
	 */
	[Symbol.iterator](): IterableIterator<[string, string]> {
		void this.#version;
		return this.#params[Symbol.iterator]();
	}
}
