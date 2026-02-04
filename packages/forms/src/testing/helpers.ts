/**
 * Form Testing Helpers
 *
 * Utility functions for testing components that use @warpkit/forms.
 */

import type { FormState } from '../types';

/**
 * Wait for a form submission to complete.
 *
 * Polls the form's isSubmitting state and resolves when it becomes false.
 * Useful for async form submissions in tests.
 *
 * @param form - The form state to wait on
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 5000)
 * @returns Promise that resolves when submission completes
 * @throws Error if timeout is exceeded
 *
 * @example
 * ```typescript
 * import { waitForFormSubmit } from '@warpkit/forms/testing';
 *
 * it('should submit successfully', async () => {
 *   await form.submit();
 *   await waitForFormSubmit(form);
 *   expect(form.submitError).toBeNull();
 * });
 * ```
 */
export async function waitForFormSubmit(form: FormState<object>, timeoutMs = 5000): Promise<void> {
	const start = Date.now();

	return new Promise((resolve, reject) => {
		const check = () => {
			if (!form.isSubmitting) {
				resolve();
				return;
			}

			if (Date.now() - start > timeoutMs) {
				reject(new Error(`Timeout waiting for form submit after ${timeoutMs}ms`));
				return;
			}

			setTimeout(check, 50);
		};

		check();
	});
}

/**
 * Wait for form validation to complete.
 *
 * Polls the form's isValidating state and resolves when it becomes false.
 * Useful for async validation in tests.
 *
 * @param form - The form state to wait on
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 5000)
 * @returns Promise that resolves when validation completes
 * @throws Error if timeout is exceeded
 *
 * @example
 * ```typescript
 * import { waitForFormValidation } from '@warpkit/forms/testing';
 *
 * it('should validate asynchronously', async () => {
 *   await form.validateField('email');
 *   await waitForFormValidation(form);
 *   expect(form.errors.email).toBeDefined();
 * });
 * ```
 */
export async function waitForFormValidation(form: FormState<object>, timeoutMs = 5000): Promise<void> {
	const start = Date.now();

	return new Promise((resolve, reject) => {
		const check = () => {
			if (!form.isValidating) {
				resolve();
				return;
			}

			if (Date.now() - start > timeoutMs) {
				reject(new Error(`Timeout waiting for form validation after ${timeoutMs}ms`));
				return;
			}

			setTimeout(check, 50);
		};

		check();
	});
}

/**
 * Set multiple form values at once.
 *
 * Convenience function to set multiple field values in a single call.
 * Uses the form's setField method internally.
 *
 * @param form - The form state to update
 * @param values - Partial object with field values to set
 *
 * @example
 * ```typescript
 * import { setFormValues } from '@warpkit/forms/testing';
 *
 * setFormValues(form, {
 *   name: 'John',
 *   email: 'john@example.com'
 * });
 * ```
 */
export function setFormValues<T extends object>(form: FormState<T>, values: Partial<T>): void {
	for (const [key, value] of Object.entries(values)) {
		form.setField(key as keyof T, value as T[keyof T]);
	}
}

/**
 * Get all form errors as a plain object.
 *
 * Returns a shallow copy of the form's errors object.
 * Useful for snapshot assertions or comparing error states.
 *
 * @param form - The form state to get errors from
 * @returns Record of field path to error message
 *
 * @example
 * ```typescript
 * import { getFormErrors } from '@warpkit/forms/testing';
 *
 * expect(getFormErrors(form)).toEqual({
 *   name: 'Required',
 *   email: 'Invalid email'
 * });
 * ```
 */
export function getFormErrors(form: FormState<object>): Record<string, string> {
	return { ...form.errors };
}

/**
 * Get all form warnings as a plain object.
 *
 * Returns a shallow copy of the form's warnings object.
 *
 * @param form - The form state to get warnings from
 * @returns Record of field path to warning message
 *
 * @example
 * ```typescript
 * import { getFormWarnings } from '@warpkit/forms/testing';
 *
 * expect(getFormWarnings(form)).toEqual({
 *   email: 'Consider using a work email'
 * });
 * ```
 */
export function getFormWarnings(form: FormState<object>): Record<string, string> {
	return { ...form.warnings };
}

/**
 * Get all touched fields as a plain object.
 *
 * Returns a shallow copy of the form's touched object.
 *
 * @param form - The form state to get touched from
 * @returns Record of field path to boolean
 *
 * @example
 * ```typescript
 * import { getFormTouched } from '@warpkit/forms/testing';
 *
 * expect(getFormTouched(form)).toEqual({
 *   name: true,
 *   email: true
 * });
 * ```
 */
export function getFormTouched(form: FormState<object>): Record<string, boolean> {
	return { ...form.touched };
}

/**
 * Get all dirty fields as a plain object.
 *
 * Returns a shallow copy of the form's dirty object.
 *
 * @param form - The form state to get dirty from
 * @returns Record of field path to boolean
 *
 * @example
 * ```typescript
 * import { getFormDirty } from '@warpkit/forms/testing';
 *
 * expect(getFormDirty(form)).toEqual({
 *   name: true,
 *   email: false
 * });
 * ```
 */
export function getFormDirty(form: FormState<object>): Record<string, boolean> {
	return { ...form.dirty };
}

/**
 * Assert that a form field has a specific error.
 *
 * Convenience assertion helper for testing.
 *
 * @param form - The form state to check
 * @param field - The field path to check
 * @param expectedMessage - Expected error message (or undefined for no error)
 * @returns true if assertion passes
 * @throws Error if assertion fails
 *
 * @example
 * ```typescript
 * import { assertFieldError } from '@warpkit/forms/testing';
 *
 * assertFieldError(form, 'name', 'Required');
 * assertFieldError(form, 'email', undefined); // no error
 * ```
 */
export function assertFieldError(
	form: FormState<object>,
	field: string,
	expectedMessage: string | undefined
): boolean {
	const actualMessage = form.errors[field];

	if (expectedMessage === undefined) {
		if (actualMessage !== undefined) {
			throw new Error(`Expected field "${field}" to have no error, but got "${actualMessage}"`);
		}
	} else {
		if (actualMessage !== expectedMessage) {
			throw new Error(
				`Expected field "${field}" to have error "${expectedMessage}", but got "${actualMessage ?? 'no error'}"`
			);
		}
	}

	return true;
}
