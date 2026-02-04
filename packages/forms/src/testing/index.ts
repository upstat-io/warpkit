/**
 * @warpkit/forms Testing Utilities
 *
 * Provides mock factories, helpers, and assertions for testing
 * components that use @warpkit/forms.
 *
 * @example
 * ```typescript
 * import {
 *   createMockForm,
 *   createMockSchema,
 *   waitForFormSubmit,
 *   assertFieldError
 * } from '@warpkit/forms/testing';
 * ```
 */

// ============================================================================
// Mock Factories
// ============================================================================

export { createMockForm } from './mock-form.svelte';
export type { MockFormOptions } from './mock-form.svelte';

export { createMockSchema, createMockIssue } from './mock-schema';
export type { MockSchemaOptions } from './mock-schema';

// ============================================================================
// Test Helpers
// ============================================================================

export {
	waitForFormSubmit,
	waitForFormValidation,
	setFormValues,
	getFormErrors,
	getFormWarnings,
	getFormTouched,
	getFormDirty,
	assertFieldError
} from './helpers';
