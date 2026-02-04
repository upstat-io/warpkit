/**
 * @warpkit/forms Validation Utilities
 *
 * Orchestrates form validation using StandardSchema from @warpkit/validation.
 * Provides utilities for validation timing, error mapping, and debouncing.
 */

import type { StandardSchema } from '@warpkit/validation';
import type { ValidationMode } from './types';
import { pathToString } from './paths';

/**
 * Normalize a StandardSchema issue path to a simple (string | number)[] array.
 *
 * StandardSchema allows paths to contain either:
 * - Simple PropertyKey values (string | number | symbol)
 * - Objects with a `key` property: `{ readonly key: PropertyKey }`
 *
 * This function normalizes both formats to a simple array for use with pathToString.
 *
 * @param path - StandardSchema issue path (or undefined)
 * @returns Normalized path as (string | number)[] or undefined
 */
function normalizePathArray(
	path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
): (string | number)[] | undefined {
	if (!path || path.length === 0) {
		return undefined;
	}

	return path.map((segment) => {
		// Handle object-wrapped path segments (used by some validators)
		if (typeof segment === 'object' && segment !== null && 'key' in segment) {
			const key = segment.key;
			// Convert symbol to string, keep string/number as-is
			return typeof key === 'symbol' ? String(key) : (key as string | number);
		}
		// Handle simple PropertyKey (string | number | symbol)
		return typeof segment === 'symbol' ? String(segment) : (segment as string | number);
	});
}

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
	/** Whether the data is valid */
	valid: boolean;
	/** Map of field paths to error messages */
	errors: Record<string, string>;
}

/**
 * Validate values against a StandardSchema synchronously.
 * Returns validation result with errors mapped by field path.
 *
 * @param schema - StandardSchema to validate against (or undefined to skip)
 * @param values - Values to validate
 * @returns Validation result with valid flag and errors map
 * @throws Error if schema returns a Promise (use validateSchemaAsync)
 *
 * @example
 * ```typescript
 * const result = validateSchema(UserSchema, { email: 'invalid' });
 * // { valid: false, errors: { email: 'Invalid email format' } }
 * ```
 */
export function validateSchema<T>(schema: StandardSchema<T> | undefined, values: T): ValidationResult {
	// No schema = always valid
	if (!schema) {
		return { valid: true, errors: {} };
	}

	const result = schema['~standard'].validate(values);

	// Check if schema returned a Promise (async validation)
	if (result instanceof Promise) {
		throw new Error('Schema returned a Promise. Use validateSchemaAsync() for async schemas.');
	}

	// Validation passed
	if ('value' in result) {
		return { valid: true, errors: {} };
	}

	// Validation failed - map issues to errors
	const errors: Record<string, string> = {};

	for (const issue of result.issues) {
		const path = pathToString(normalizePathArray(issue.path));
		const key = path || '_root';
		// Only keep first error for each path
		if (!(key in errors)) {
			errors[key] = issue.message;
		}
	}

	return { valid: false, errors };
}

/**
 * Validate values against a StandardSchema asynchronously.
 * Handles both sync and async validation schemas.
 *
 * @param schema - StandardSchema to validate against (or undefined to skip)
 * @param values - Values to validate
 * @returns Promise resolving to validation result
 *
 * @example
 * ```typescript
 * const result = await validateSchemaAsync(AsyncUserSchema, { email: 'test@example.com' });
 * // { valid: true, errors: {} }
 * ```
 */
export async function validateSchemaAsync<T>(
	schema: StandardSchema<T> | undefined,
	values: T
): Promise<ValidationResult> {
	// No schema = always valid
	if (!schema) {
		return { valid: true, errors: {} };
	}

	const result = await schema['~standard'].validate(values);

	// Validation passed
	if ('value' in result) {
		return { valid: true, errors: {} };
	}

	// Validation failed - map issues to errors
	const errors: Record<string, string> = {};

	for (const issue of result.issues) {
		const path = pathToString(normalizePathArray(issue.path));
		const key = path || '_root';
		// Only keep first error for each path
		if (!(key in errors)) {
			errors[key] = issue.message;
		}
	}

	return { valid: false, errors };
}

/**
 * Determine if validation should run based on mode and event.
 *
 * @param mode - Current validation mode
 * @param event - Event that triggered potential validation
 * @returns True if validation should run
 *
 * @example
 * ```typescript
 * shouldValidate('submit', 'submit'); // true
 * shouldValidate('submit', 'blur');   // false
 * shouldValidate('blur', 'blur');     // true
 * shouldValidate('change', 'change'); // true
 * ```
 */
export function shouldValidate(mode: ValidationMode, event: 'submit' | 'blur' | 'change'): boolean {
	switch (mode) {
		case 'submit':
			// Only validate on form submission
			return event === 'submit';

		case 'blur':
			// Validate on blur and submit
			return event === 'blur' || event === 'submit';

		case 'change':
			// Validate on every change, blur, and submit
			return true;

		case 'touched':
			// Validate on blur and submit (same as 'blur' for triggering)
			// The actual "touched" check is done by the form state
			return event === 'blur' || event === 'submit';

		default:
			return false;
	}
}

/**
 * Interface for debounced error state management.
 */
export interface ErrorDebouncer {
	/**
	 * Set an error for a field (debounced).
	 * @param path - Field path
	 * @param error - Error message
	 */
	set(path: string, error: string): void;

	/**
	 * Clear an error for a field immediately.
	 * @param path - Field path
	 */
	clear(path: string): void;

	/**
	 * Clear all errors and pending timers.
	 */
	clearAll(): void;

	/**
	 * Get current errors (only includes committed errors).
	 */
	getErrors(): Record<string, string>;
}

/**
 * Create a debounced error state manager.
 * Delays error display to avoid flickering during rapid input.
 *
 * @param delayMs - Delay in milliseconds before committing errors (default: 0)
 * @returns ErrorDebouncer instance
 *
 * @example
 * ```typescript
 * const debouncer = createErrorDebouncer(300);
 *
 * debouncer.set('email', 'Invalid email');
 * // After 300ms, getErrors() returns { email: 'Invalid email' }
 *
 * debouncer.clear('email');
 * // Immediately clears the error
 * ```
 */
export function createErrorDebouncer(delayMs = 0): ErrorDebouncer {
	const errors: Record<string, string> = {};
	const timers: Record<string, ReturnType<typeof setTimeout>> = {};

	return {
		set(path: string, error: string) {
			// Clear any existing timer for this path
			if (timers[path]) {
				clearTimeout(timers[path]);
				delete timers[path];
			}

			if (delayMs <= 0) {
				// No delay - set immediately
				errors[path] = error;
			} else {
				// Debounce - set after delay
				timers[path] = setTimeout(() => {
					errors[path] = error;
					delete timers[path];
				}, delayMs);
			}
		},

		clear(path: string) {
			// Clear pending timer
			if (timers[path]) {
				clearTimeout(timers[path]);
				delete timers[path];
			}
			// Clear error immediately
			delete errors[path];
		},

		clearAll() {
			// Clear all pending timers
			for (const timer of Object.values(timers)) {
				clearTimeout(timer);
			}
			// Clear all state
			for (const key of Object.keys(timers)) {
				delete timers[key];
			}
			for (const key of Object.keys(errors)) {
				delete errors[key];
			}
		},

		getErrors() {
			return { ...errors };
		}
	};
}
