/**
 * Pure Form Logic Functions
 *
 * These functions contain the core logic for form state management.
 * Extracted from hooks.svelte.ts to enable unit testing without Svelte runtime.
 */

import type { ValidationMode, RevalidateMode } from './types';

/**
 * Determine if a field should be validated based on mode, event, and state.
 *
 * @param options - Validation context
 * @returns true if validation should run
 */
export function shouldValidateField(options: {
	field: string;
	event: 'change' | 'blur';
	mode: ValidationMode;
	revalidateMode: RevalidateMode;
	hasError: boolean;
	isSubmitted: boolean;
	isTouched: boolean;
}): boolean {
	const { field, event, mode, revalidateMode, hasError, isSubmitted, isTouched } = options;

	// If field already has error, use revalidateMode
	if (hasError) {
		return revalidateMode === event || revalidateMode === 'change';
	}

	// If form has been submitted, always validate
	if (isSubmitted) {
		return true;
	}

	// Use mode to determine validation timing
	switch (mode) {
		case 'submit':
			return false;
		case 'blur':
			return event === 'blur';
		case 'change':
			return true;
		case 'touched':
			return isTouched && event === 'change';
		default:
			return false;
	}
}

/**
 * Reindex error keys after array modification.
 *
 * When an item is added or removed from an array, error keys need to be updated
 * to reflect the new indices.
 *
 * @param errors - Current error state
 * @param field - Array field path (e.g., 'items')
 * @param fromIndex - Index where modification occurred
 * @param delta - Change in size (-1 for remove, +1 for insert)
 * @returns New errors object with reindexed keys
 */
export function reindexArrayErrors(
	errors: Record<string, string>,
	field: string,
	fromIndex: number,
	delta: number
): Record<string, string> {
	const prefix = `${field}.`;
	const newErrors: Record<string, string> = {};

	for (const [key, value] of Object.entries(errors)) {
		if (key.startsWith(prefix)) {
			const rest = key.slice(prefix.length);
			const match = rest.match(/^(\d+)(.*)/);

			if (match) {
				const idx = parseInt(match[1], 10);
				const suffix = match[2];

				if (delta < 0) {
					// Removing: skip the removed index, shift higher indices down
					if (idx < fromIndex) {
						newErrors[key] = value;
					} else if (idx > fromIndex) {
						newErrors[`${field}.${idx + delta}${suffix}`] = value;
					}
					// idx === fromIndex is skipped (removed)
				} else {
					// Inserting: shift indices at or above fromIndex up
					if (idx < fromIndex) {
						newErrors[key] = value;
					} else {
						newErrors[`${field}.${idx + delta}${suffix}`] = value;
					}
				}
			} else {
				newErrors[key] = value;
			}
		} else {
			newErrors[key] = value;
		}
	}

	return newErrors;
}

function isEmptyPlainObject(v: unknown): boolean {
	return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0;
}

function isLeafEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (Array.isArray(a) && Array.isArray(b) && a.length === 0 && b.length === 0) return true;
	if (isEmptyPlainObject(a) && isEmptyPlainObject(b)) return true;
	return false;
}

/**
 * Calculate dirty state for all paths by comparing current values to initial.
 *
 * @param current - Current form values
 * @param initial - Initial form values
 * @param paths - All paths to check
 * @param getPath - Function to get value at path
 * @returns Record of path to dirty state
 */
export function calculateDirtyState<T>(
	current: T,
	initial: T,
	paths: string[],
	getPath: (obj: T, path: string) => unknown
): Record<string, boolean> {
	const result: Record<string, boolean> = {};
	for (const path of paths) {
		const currentValue = getPath(current, path);
		const initialValue = getPath(initial, path);
		result[path] = !isLeafEqual(currentValue, initialValue);
	}
	return result;
}

/**
 * Merge schema defaults with user-provided initial values.
 *
 * @param schemaDefaults - Defaults extracted from schema
 * @param initialValues - User-provided initial values
 * @returns Merged values with user values taking precedence
 */
export function mergeInitialValues<T extends object>(
	schemaDefaults: Partial<T> | undefined,
	initialValues: Partial<T> | undefined
): T {
	// Use JSON clone to handle potential Svelte 5 reactive proxies
	return JSON.parse(
		JSON.stringify({
			...schemaDefaults,
			...initialValues
		})
	) as T;
}

/**
 * Debouncer interface for error display delay.
 */
export interface ErrorDebouncer {
	set(field: string, message: string, setError: (field: string, message: string) => void): void;
	clear(field: string): void;
	clearAll(): void;
	hasPending(field: string): boolean;
}

/**
 * Create a debounced error setter.
 *
 * @param delayMs - Delay in milliseconds (0 = no delay)
 * @returns Object with set and clear functions
 */
export function createErrorDebouncer(delayMs: number): ErrorDebouncer {
	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	return {
		/**
		 * Set an error with optional delay.
		 * @param field - Field path
		 * @param message - Error message
		 * @param setError - Callback to actually set the error
		 */
		set(field: string, message: string, setError: (field: string, message: string) => void): void {
			// Clear any existing timer
			const existingTimer = timers.get(field);
			if (existingTimer) {
				clearTimeout(existingTimer);
				timers.delete(field);
			}

			if (delayMs <= 0) {
				// No delay - set immediately
				setError(field, message);
			} else {
				// Debounce - set after delay
				const timer = setTimeout(() => {
					setError(field, message);
					timers.delete(field);
				}, delayMs);
				timers.set(field, timer);
			}
		},

		/**
		 * Clear a pending error timer.
		 * @param field - Field path
		 */
		clear(field: string): void {
			const existingTimer = timers.get(field);
			if (existingTimer) {
				clearTimeout(existingTimer);
				timers.delete(field);
			}
		},

		/**
		 * Clear all pending error timers.
		 */
		clearAll(): void {
			for (const timer of timers.values()) {
				clearTimeout(timer);
			}
			timers.clear();
		},

		/**
		 * Check if a field has a pending timer.
		 */
		hasPending(field: string): boolean {
			return timers.has(field);
		}
	};
}

/**
 * Parse array error key to extract index and suffix.
 *
 * @param key - Error key like "items.0.name"
 * @param prefix - Array field prefix like "items."
 * @returns Parsed result or null if not matching
 */
export function parseArrayErrorKey(
	key: string,
	prefix: string
): { index: number; suffix: string } | null {
	if (!key.startsWith(prefix)) {
		return null;
	}

	const rest = key.slice(prefix.length);
	const match = rest.match(/^(\d+)(.*)/);

	if (!match) {
		return null;
	}

	return {
		index: parseInt(match[1], 10),
		suffix: match[2]
	};
}

/**
 * Check if any value in a record is true.
 *
 * @param record - Record to check
 * @returns true if any value is true
 */
export function hasAnyTrue(record: Record<string, boolean>): boolean {
	return Object.values(record).some(Boolean);
}

/**
 * Check if a record has any entries.
 *
 * @param record - Record to check
 * @returns true if record is empty
 */
export function isEmptyRecord(record: Record<string, unknown>): boolean {
	return Object.keys(record).length === 0;
}

/**
 * Remove a key from a record immutably.
 *
 * @param record - Record to modify
 * @param key - Key to remove
 * @returns New record without the key
 */
export function removeKey<T>(record: Record<string, T>, key: string): Record<string, T> {
	const { [key]: _, ...rest } = record;
	return rest;
}

/**
 * Add or update a key in a record immutably.
 *
 * @param record - Record to modify
 * @param key - Key to add/update
 * @param value - Value to set
 * @returns New record with the key
 */
export function setKey<T>(record: Record<string, T>, key: string, value: T): Record<string, T> {
	return { ...record, [key]: value };
}
