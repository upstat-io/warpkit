/**
 * @warpkit/forms Type Definitions
 *
 * Core types for schema-driven form state management in Svelte 5.
 * Uses StandardSchema from @warpkit/validation for validation.
 */

import type { StandardSchema } from '@warpkit/validation';

// ============================================================================
// Validation Modes
// ============================================================================

/**
 * When to start validating form fields.
 *
 * - 'submit': Only validate on form submission (default for minimal UX friction)
 * - 'blur': Validate when field loses focus
 * - 'change': Validate on every change (can be noisy)
 * - 'touched': Validate after field has been touched and on subsequent changes
 */
export type ValidationMode = 'submit' | 'blur' | 'change' | 'touched';

/**
 * When to revalidate after first error is shown.
 *
 * - 'change': Revalidate on every change (immediate feedback)
 * - 'blur': Revalidate when field loses focus (less noisy)
 */
export type RevalidateMode = 'change' | 'blur';

// ============================================================================
// Field Validator
// ============================================================================

/**
 * Custom validator function for a single field.
 * Can be synchronous or asynchronous.
 *
 * @param value - The current value of the field
 * @param values - All form values for cross-field validation
 * @returns Error message string if invalid, undefined if valid
 *
 * @example
 * ```typescript
 * const passwordConfirm: FieldValidator<FormData, string> = (value, values) => {
 *   if (value !== values.password) {
 *     return 'Passwords must match';
 *   }
 *   return undefined;
 * };
 * ```
 */
export type FieldValidator<T, V = unknown> = (
	value: V,
	values: T
) => string | undefined | Promise<string | undefined>;

// ============================================================================
// Field State
// ============================================================================

/**
 * Field-centric view of a single field's state.
 * Provides focused access to a field's value, errors, and metadata.
 *
 * @example
 * ```typescript
 * const emailField = form.field<string>('email');
 *
 * // Access field state
 * console.log(emailField.value);    // 'user@example.com'
 * console.log(emailField.error);    // 'Invalid email format'
 * console.log(emailField.touched);  // true
 * console.log(emailField.dirty);    // true
 * ```
 */
export interface FieldState<V = unknown> {
	/** Current value of the field */
	get value(): V;
	/** Error message if field is invalid, undefined if valid */
	get error(): string | undefined;
	/** Warning message (non-blocking validation feedback) */
	get warning(): string | undefined;
	/** Whether the field has been focused and blurred */
	get touched(): boolean;
	/** Whether the field value differs from initial value */
	get dirty(): boolean;
}

// ============================================================================
// Form Errors
// ============================================================================

/**
 * Typed error map for form fields.
 *
 * Top-level keys from `T` have autocomplete support.
 * Dot-notation paths for nested fields use the index signature.
 *
 * @example
 * ```typescript
 * // Autocomplete for top-level keys:
 * form.errors.name    // string | undefined
 * form.errors.email   // string | undefined
 *
 * // Index access for nested paths:
 * form.errors['user.address.street'] // string | undefined
 * ```
 */
export type FormErrors<T> = {
	[K in keyof T & string]?: string;
} & {
	[path: string]: string | undefined;
};

/**
 * Field path type that provides autocomplete for top-level keys
 * while still accepting arbitrary dot-notation paths for nested access.
 *
 * Uses the `(string & {})` TypeScript pattern to preserve autocomplete hints.
 */
export type FieldPath<T> = (keyof T & string) | (string & {});

// ============================================================================
// Form Options
// ============================================================================

/**
 * Configuration options for creating a form.
 *
 * @example
 * ```typescript
 * const options: FormOptions<LoginForm> = {
 *   initialValues: { email: '', password: '' },
 *   schema: LoginSchema,
 *   mode: 'blur',
 *   revalidateMode: 'change',
 *   onSubmit: async (values) => {
 *     await api.login(values);
 *   }
 * };
 * ```
 */
export interface FormOptions<T> {
	/** Initial values for the form fields */
	initialValues: T;

	/** StandardSchema for validation (from @warpkit/validation) */
	schema?: StandardSchema<T>;

	/**
	 * When to start validating fields.
	 * @default 'blur'
	 */
	mode?: ValidationMode;

	/**
	 * When to revalidate after first error is shown.
	 * @default 'change'
	 */
	revalidateMode?: RevalidateMode;

	/**
	 * Delay in milliseconds before showing errors.
	 * Useful for debouncing error display during typing.
	 * @default 0
	 */
	delayError?: number;

	/**
	 * Custom validators for individual fields.
	 * Run after schema validation.
	 */
	validators?: Partial<Record<keyof T, FieldValidator<T>>>;

	/**
	 * Warning validators for individual fields.
	 * Warnings are non-blocking feedback shown to users.
	 */
	warners?: Partial<Record<keyof T, FieldValidator<T>>>;

	/**
	 * Callback invoked when form is submitted with valid data.
	 * Can be async - form will show isSubmitting state while pending.
	 */
	onSubmit: (values: T) => void | Promise<void>;
}

// ============================================================================
// Form State
// ============================================================================

/**
 * Complete form state interface with reactive getters and methods.
 * Returned by the useForm hook.
 *
 * @example
 * ```typescript
 * const form = useForm<LoginForm>({
 *   initialValues: { email: '', password: '' },
 *   schema: LoginSchema,
 *   onSubmit: async (values) => { await login(values); }
 * });
 *
 * // Bind to form data
 * <input bind:value={form.data.email} />
 *
 * // Show errors
 * {#if form.errors.email}
 *   <span class="error">{form.errors.email}</span>
 * {/if}
 *
 * // Submit form
 * <form on:submit={form.submit}>
 *   <button disabled={form.isSubmitting}>Submit</button>
 * </form>
 * ```
 */
export interface FormState<T> {
	// =========================================================================
	// Reactive State (via getters)
	// =========================================================================

	/** Current form data (reactive, supports bind:value through proxy) */
	get data(): T;

	/** Typed map of field names to error messages. Top-level keys have autocomplete. */
	get errors(): FormErrors<T>;

	/** Map of field paths to warning messages */
	get warnings(): Record<string, string>;

	/** Map of field paths to touched state */
	get touched(): Record<string, boolean>;

	/** Map of field paths to dirty state */
	get dirty(): Record<string, boolean>;

	/** True if form has no validation errors */
	get isValid(): boolean;

	/** True if any field value differs from initial */
	get isDirty(): boolean;

	/** True while onSubmit is executing */
	get isSubmitting(): boolean;

	/** True while validation is running */
	get isValidating(): boolean;

	/** True after form has been submitted at least once */
	get isSubmitted(): boolean;

	/** Error thrown by onSubmit, null if none */
	get submitError(): Error | null;

	/** Number of times form has been submitted */
	get submitCount(): number;

	// =========================================================================
	// Form Operations
	// =========================================================================

	/**
	 * Submit the form. Validates all fields and calls onSubmit if valid.
	 * Can be used as event handler: `<form on:submit={form.submit}>`
	 *
	 * @param event - Optional event to prevent default
	 */
	submit(event?: Event): Promise<void>;

	/**
	 * Reset form to initial values or provided values.
	 * Clears all errors, warnings, touched, and dirty state.
	 *
	 * @param newValues - Optional partial values to merge with initial
	 */
	reset(newValues?: Partial<T>): void;

	/**
	 * Validate all fields and return validity.
	 *
	 * @returns Promise resolving to true if valid, false if invalid
	 */
	validate(): Promise<boolean>;

	/**
	 * Validate a single field.
	 *
	 * @param field - Field name to validate
	 * @returns Promise resolving to true if valid, false if invalid
	 */
	validateField(field: FieldPath<T>): Promise<boolean>;

	// =========================================================================
	// Field Operations
	// =========================================================================

	/**
	 * Set a field value programmatically.
	 *
	 * @param field - Field key
	 * @param value - New value for the field
	 */
	setField<K extends keyof T>(field: K, value: T[K]): void;

	/**
	 * Set or clear an error message for a field.
	 *
	 * @param field - Field name
	 * @param message - Error message or null to clear
	 */
	setError(field: FieldPath<T>, message: string | null): void;

	/**
	 * Set or clear a warning message for a field.
	 *
	 * @param field - Field name
	 * @param message - Warning message or null to clear
	 */
	setWarning(field: FieldPath<T>, message: string | null): void;

	/**
	 * Mark a field as touched.
	 *
	 * @param field - Field name
	 */
	touch(field: FieldPath<T>): void;

	/**
	 * Clear all error messages.
	 */
	clearErrors(): void;

	// =========================================================================
	// Array Operations
	// =========================================================================

	/**
	 * Append a value to an array field.
	 *
	 * @param field - Array field name
	 * @param value - Value to append
	 */
	push(field: FieldPath<T>, value: unknown): void;

	/**
	 * Remove an item from an array field by index.
	 *
	 * @param field - Array field name
	 * @param index - Index to remove
	 */
	remove(field: FieldPath<T>, index: number): void;

	/**
	 * Insert a value at a specific index in an array field.
	 *
	 * @param field - Array field name
	 * @param index - Index to insert at
	 * @param value - Value to insert
	 */
	insert(field: FieldPath<T>, index: number, value: unknown): void;

	/**
	 * Move an item from one index to another in an array field.
	 *
	 * @param field - Array field name
	 * @param from - Source index
	 * @param to - Destination index
	 */
	move(field: FieldPath<T>, from: number, to: number): void;

	/**
	 * Swap two items in an array field.
	 *
	 * @param field - Array field name
	 * @param indexA - First index
	 * @param indexB - Second index
	 */
	swap(field: FieldPath<T>, indexA: number, indexB: number): void;

	// =========================================================================
	// Field-Centric Access
	// =========================================================================

	/**
	 * Get a field-centric view of a single field's state.
	 * Useful for creating reusable field components.
	 *
	 * @param path - Dot-notation path to the field
	 * @returns FieldState for the specified field
	 *
	 * @example
	 * ```typescript
	 * const emailField = form.field<string>('email');
	 * console.log(emailField.value, emailField.error);
	 * ```
	 */
	field<V = unknown>(path: FieldPath<T>): FieldState<V>;

	// =========================================================================
	// Dirty Tracking
	// =========================================================================

	/**
	 * Snapshot current values as the new baseline for dirty tracking.
	 * After calling this, `isDirty` becomes `false` until the user makes
	 * further changes. Useful for "save and stay" flows where you want to
	 * clear the dirty state without resetting form values.
	 *
	 * @example
	 * ```typescript
	 * async function handleSave(values: FormData) {
	 *   await api.save(values);
	 *   form.resetDirty(); // Clear dirty state after successful save
	 * }
	 * ```
	 */
	resetDirty(): void;

	// =========================================================================
	// Lifecycle
	// =========================================================================

	/**
	 * Clean up form resources (error timers).
	 * This is called automatically when the component unmounts (via `$effect`),
	 * so you typically don't need to call it manually. It remains available
	 * for edge cases where `useForm` is called outside a component context.
	 */
	cleanup(): void;
}
