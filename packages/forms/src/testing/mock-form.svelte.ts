/**
 * Mock Form Factory for Testing
 *
 * Creates a pre-configured mock FormState instance for testing components
 * that use @warpkit/forms. Provides configurable initial state and no-op methods.
 */

import type { FormState, FieldState } from '../types';

/**
 * Options for createMockForm.
 */
export interface MockFormOptions<T extends object> {
	/** Initial form values */
	initialValues?: T;
	/** Pre-configured errors */
	errors?: Record<string, string>;
	/** Pre-configured warnings */
	warnings?: Record<string, string>;
	/** Pre-configured touched state */
	touched?: Record<string, boolean>;
	/** Pre-configured dirty state */
	dirty?: Record<string, boolean>;
	/** Initial isValid state (default: true) */
	isValid?: boolean;
	/** Initial isDirty state (default: false) */
	isDirty?: boolean;
	/** Initial isSubmitting state (default: false) */
	isSubmitting?: boolean;
	/** Initial isValidating state (default: false) */
	isValidating?: boolean;
	/** Initial isSubmitted state (default: false) */
	isSubmitted?: boolean;
	/** Initial submitError (default: null) */
	submitError?: Error | null;
	/** Initial submitCount (default: 0) */
	submitCount?: number;
}

/**
 * Creates a mock FormState for testing.
 *
 * Unlike the real useForm hook, this mock doesn't require a Svelte component context.
 * Configure initial state with options, then use in tests to verify component behavior.
 *
 * @param options - Optional configuration
 * @returns FormState instance with mocked values and no-op methods
 *
 * @example
 * ```typescript
 * import { createMockForm } from '@warpkit/forms/testing';
 *
 * describe('MyFormComponent', () => {
 *   it('should display errors', () => {
 *     const mockForm = createMockForm({
 *       errors: { name: 'Required' }
 *     });
 *
 *     // Render component with mockForm...
 *     // Verify error is displayed
 *   });
 * });
 * ```
 */
export function createMockForm<T extends object>(options: MockFormOptions<T> = {}): FormState<T> {
	const {
		initialValues = {} as T,
		errors: initialErrors = {},
		warnings: initialWarnings = {},
		touched: initialTouched = {},
		dirty: initialDirty = {},
		isValid: initialIsValid = true,
		isDirty: initialIsDirty = false,
		isSubmitting: initialIsSubmitting = false,
		isValidating: initialIsValidating = false,
		isSubmitted: initialIsSubmitted = false,
		submitError: initialSubmitError = null,
		submitCount: initialSubmitCount = 0
	} = options;

	// Use $state for reactive properties
	// Variables that are reassigned use let, others use const
	const dataState = $state<T>(structuredClone(initialValues));
	let errorsState = $state<Record<string, string>>(initialErrors);
	let warningsState = $state<Record<string, string>>(initialWarnings);
	let touchedState = $state<Record<string, boolean>>(initialTouched);
	const dirtyState = $state<Record<string, boolean>>(initialDirty);
	const isValidState = $state(initialIsValid);
	const isDirtyState = $state(initialIsDirty);
	const isSubmittingState = $state(initialIsSubmitting);
	const isValidatingState = $state(initialIsValidating);
	const isSubmittedState = $state(initialIsSubmitted);
	const submitErrorState = $state<Error | null>(initialSubmitError);
	const submitCountState = $state(initialSubmitCount);

	return {
		// Reactive state (via getters)
		get data() {
			return dataState;
		},
		get errors() {
			return errorsState;
		},
		get warnings() {
			return warningsState;
		},
		get touched() {
			return touchedState;
		},
		get dirty() {
			return dirtyState;
		},
		get isValid() {
			return isValidState;
		},
		get isDirty() {
			return isDirtyState;
		},
		get isSubmitting() {
			return isSubmittingState;
		},
		get isValidating() {
			return isValidatingState;
		},
		get isSubmitted() {
			return isSubmittedState;
		},
		get submitError() {
			return submitErrorState;
		},
		get submitCount() {
			return submitCountState;
		},

		// Form operations (no-ops by default)
		submit: async () => {},
		reset: () => {},
		validate: async () => true,
		validateField: async () => true,

		// Field operations
		setField: <K extends keyof T>(_field: K, _value: T[K]) => {},
		setError: (field: string, message: string | null) => {
			if (message) {
				errorsState = { ...errorsState, [field]: message };
			} else {
				const { [field]: _, ...rest } = errorsState;
				errorsState = rest;
			}
		},
		setWarning: (field: string, message: string | null) => {
			if (message) {
				warningsState = { ...warningsState, [field]: message };
			} else {
				const { [field]: _, ...rest } = warningsState;
				warningsState = rest;
			}
		},
		touch: (field: string) => {
			touchedState = { ...touchedState, [field]: true };
		},
		clearErrors: () => {
			errorsState = {};
			warningsState = {};
		},

		// Array operations (no-ops by default)
		push: () => {},
		remove: () => {},
		insert: () => {},
		move: () => {},
		swap: () => {},

		// Field-centric access
		field: <V = unknown>(path: string): FieldState<V> => ({
			get value() {
				return (dataState as Record<string, unknown>)[path] as V;
			},
			get error() {
				return errorsState[path];
			},
			get warning() {
				return warningsState[path];
			},
			get touched() {
				return touchedState[path] ?? false;
			},
			get dirty() {
				return dirtyState[path] ?? false;
			}
		})
	};
}
