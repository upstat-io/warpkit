/**
 * Mock Schema Factory for Testing
 *
 * Creates a pre-configured mock StandardSchema instance for testing form validation.
 * Supports both sync and async validation modes.
 */

import type { StandardSchema, StandardResult, StandardIssue } from '@warpkit/validation';

/**
 * Options for createMockSchema.
 */
export interface MockSchemaOptions<T> {
	/** Validation issues to return. Empty array or undefined = valid */
	issues?: StandardIssue[];
	/** Delay in ms for async validation (default: sync validation) */
	asyncDelay?: number;
	/** Custom validation function for dynamic validation */
	validate?: (value: unknown) => { value: T } | { issues: StandardIssue[] };
}

/**
 * Creates a mock StandardSchema for testing.
 *
 * Configure the schema to return specific validation issues or use a custom
 * validation function for more complex testing scenarios.
 *
 * @param options - Optional configuration
 * @returns StandardSchema instance that returns configured validation results
 *
 * @example
 * ```typescript
 * import { createMockSchema } from '@warpkit/forms/testing';
 *
 * // Always valid
 * const validSchema = createMockSchema();
 *
 * // Always returns specific errors
 * const invalidSchema = createMockSchema({
 *   issues: [{ path: ['name'], message: 'Required' }]
 * });
 *
 * // Async validation with delay
 * const asyncSchema = createMockSchema({
 *   issues: [{ path: ['email'], message: 'Invalid email' }],
 *   asyncDelay: 100
 * });
 *
 * // Custom validation logic
 * const customSchema = createMockSchema({
 *   validate: (value) => {
 *     const v = value as { name: string };
 *     if (!v.name) {
 *       return { issues: [{ path: ['name'], message: 'Required' }] };
 *     }
 *     return { value: v };
 *   }
 * });
 * ```
 */
export function createMockSchema<T>(options: MockSchemaOptions<T> = {}): StandardSchema<T> {
	const { issues, asyncDelay, validate: customValidate } = options;

	const validateSync = (value: unknown): StandardResult<T> => {
		// Use custom validation if provided
		if (customValidate) {
			return customValidate(value);
		}

		// Return configured issues or success
		if (issues && issues.length > 0) {
			return { issues };
		}
		return { value: value as T };
	};

	return {
		'~standard': {
			version: 1,
			vendor: 'mock',
			validate:
				asyncDelay !== undefined
					? async (value: unknown): Promise<StandardResult<T>> => {
							await new Promise((resolve) => setTimeout(resolve, asyncDelay));
							return validateSync(value);
						}
					: validateSync
		}
	};
}

/**
 * Helper to create a mock validation issue.
 *
 * @param path - Path to the field (e.g., ['name'] or ['user', 'email'])
 * @param message - Error message
 * @returns StandardIssue object
 *
 * @example
 * ```typescript
 * const schema = createMockSchema({
 *   issues: [
 *     createMockIssue(['name'], 'Required'),
 *     createMockIssue(['user', 'email'], 'Invalid email')
 *   ]
 * });
 * ```
 */
export function createMockIssue(path: PropertyKey[], message: string): StandardIssue {
	return { path, message };
}
