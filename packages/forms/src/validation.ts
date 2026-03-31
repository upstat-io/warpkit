/**
 * @warpkit/forms Validation Utilities
 *
 * Orchestrates form validation using StandardSchema from @warpkit/validation.
 * Auto-detects TypeBox schemas and validates them natively when ~standard is not present.
 * Provides utilities for validation timing, error mapping, and debouncing.
 */

import type { StandardSchema } from '@warpkit/validation';
import { isStandardSchema } from '@warpkit/validation';
import type { ValidationMode } from './types';
import { pathToString } from './paths';

/** Symbol used by TypeBox to mark schema objects */
const TypeBoxKind = Symbol.for('TypeBox.Kind');

/**
 * Check if a value is a TypeBox schema (has the TypeBox.Kind symbol).
 */
function isTypeBoxSchema(value: unknown): boolean {
	return typeof value === 'object' && value !== null && TypeBoxKind in value;
}

/**
 * Convert a JSON Pointer path (e.g. "/address/street") to dot notation ("address.street").
 */
function jsonPointerToDotPath(pointer: string): string {
	if (!pointer || pointer === '/') return '';
	return pointer.slice(1).replace(/\//g, '.');
}

/**
 * Validate values against a TypeBox schema using TypeBox's native Value.Check/Value.Errors.
 * Requires @sinclair/typebox to be installed by the consumer.
 */
async function validateTypeBoxAsync<T>(schema: unknown, values: T): Promise<ValidationResult> {
	if (!_typeboxValue) {
		const { Value } = await import('@sinclair/typebox/value');
		_typeboxValue = Value;
	}
	const Value = _typeboxValue;

	if (Value.Check(schema as never, values)) {
		return { valid: true, errors: {} };
	}

	const errors: Record<string, string> = {};
	for (const error of Value.Errors(schema as never, values)) {
		const path = jsonPointerToDotPath(error.path);
		const key = path || '_root';
		if (!(key in errors)) {
			errors[key] = extractTypeBoxErrorMessage(error);
		}
	}

	return { valid: false, errors };
}

// Cache for TypeBox Value module (loaded once via dynamic import, reused by sync path)
let _typeboxValue: { Check: (schema: never, value: unknown) => boolean; Errors: (schema: never, value: unknown) => Iterable<{ path: string; message: string; schema: Record<string, unknown> }> } | undefined;

/**
 * Extract the best error message from a TypeBox validation error.
 * Prefers custom `error` annotation on the schema if present, falls back to default message.
 */
function extractTypeBoxErrorMessage(error: { message: string; schema: Record<string, unknown> }): string {
	if (typeof error.schema?.error === 'string') {
		return error.schema.error;
	}
	return error.message;
}

/**
 * Validate values against a TypeBox schema synchronously.
 * Requires that validateTypeBoxAsync was called first to cache the TypeBox module.
 * Falls back to assuming valid if TypeBox hasn't been loaded yet.
 */
function validateTypeBoxSync<T>(schema: unknown, values: T): ValidationResult {
	if (!_typeboxValue) {
		// TypeBox not yet loaded — can't validate synchronously without it.
		// The async path will handle this properly on first submit.
		throw new Error(
			'TypeBox schema detected but TypeBox is not loaded for sync validation. ' +
			'Use validateSchemaAsync() instead.'
		);
	}

	if (_typeboxValue.Check(schema as never, values)) {
		return { valid: true, errors: {} };
	}

	const errors: Record<string, string> = {};
	for (const error of _typeboxValue.Errors(schema as never, values)) {
		const path = jsonPointerToDotPath(error.path);
		const key = path || '_root';
		if (!(key in errors)) {
			errors[key] = extractTypeBoxErrorMessage(error);
		}
	}

	return { valid: false, errors };
}

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

	// StandardSchema path
	if (isStandardSchema(schema)) {
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
			if (!(key in errors)) {
				errors[key] = issue.message;
			}
		}

		return { valid: false, errors };
	}

	// TypeBox schema fallback
	if (isTypeBoxSchema(schema)) {
		return validateTypeBoxSync(schema, values);
	}

	throw new Error(
		'Schema does not implement StandardSchema (~standard) and is not a TypeBox schema. ' +
		'Use a StandardSchema-compatible validator (Zod, Valibot, ArkType) or TypeBox.'
	);
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

	// StandardSchema path
	if (isStandardSchema(schema)) {
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
			if (!(key in errors)) {
				errors[key] = issue.message;
			}
		}

		return { valid: false, errors };
	}

	// TypeBox schema fallback
	if (isTypeBoxSchema(schema)) {
		return validateTypeBoxAsync(schema, values);
	}

	throw new Error(
		'Schema does not implement StandardSchema (~standard) and is not a TypeBox schema. ' +
		'Use a StandardSchema-compatible validator (Zod, Valibot, ArkType) or TypeBox.'
	);
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
