/**
 * @warpkit/forms useForm Hook
 *
 * Schema-driven form state management for Svelte 5.
 * Uses deep proxy for transparent bind:value support.
 */

import { reportError } from '@warpkit/errors';
import type { StandardSchema } from '@warpkit/validation';
import type {
	FormOptions,
	FormState,
	FieldState,
	ValidationMode,
	RevalidateMode,
	FieldValidator
} from './types';
import { createDeepProxy } from './proxy';
import { validateSchemaAsync } from './validation';
import { extractDefaults, type TypeBoxSchemaLike } from './defaults';
import { getPath, setPath, getAllPaths, getStructuralSignature } from './paths';
import {
	shouldValidateField as shouldValidate,
	reindexArrayErrors as reindexErrors,
	mergeInitialValues,
	createErrorDebouncer,
	calculateDirtyState,
	removeKey,
	setKey
} from './form-logic';

const DEFAULT_MODE: ValidationMode = 'blur';
const DEFAULT_REVALIDATE_MODE: RevalidateMode = 'change';

/**
 * Create a reactive form state manager for Svelte 5.
 *
 * @param options - Form configuration options
 * @returns FormState with reactive properties and methods
 *
 * @example
 * ```svelte
 * <script>
 *   import { useForm } from '@warpkit/forms';
 *   import { Type } from '@sinclair/typebox';
 *
 *   const schema = Type.Object({
 *     email: Type.String({ format: 'email' }),
 *     password: Type.String({ minLength: 8 })
 *   });
 *
 *   const form = useForm({
 *     initialValues: { email: '', password: '' },
 *     schema,
 *     onSubmit: async (values) => {
 *       await api.login(values);
 *     }
 *   });
 * </script>
 *
 * <form onsubmit={form.submit}>
 *   <input bind:value={form.data.email} onblur={() => form.touch('email')} />
 *   {#if form.errors.email}<span class="error">{form.errors.email}</span>{/if}
 *
 *   <input type="password" bind:value={form.data.password} onblur={() => form.touch('password')} />
 *   {#if form.errors.password}<span class="error">{form.errors.password}</span>{/if}
 *
 *   <button type="submit" disabled={form.isSubmitting}>
 *     {form.isSubmitting ? 'Submitting...' : 'Submit'}
 *   </button>
 * </form>
 * ```
 */
export function useForm<T extends object>(options: FormOptions<T>): FormState<T> {
	const {
		schema,
		onSubmit,
		mode = DEFAULT_MODE,
		revalidateMode = DEFAULT_REVALIDATE_MODE,
		delayError = 0,
		validators = {},
		warners = {}
	} = options;

	// Merge schema defaults with initial values
	const schemaDefaults = extractDefaults<T>(schema as TypeBoxSchemaLike | undefined);
	const initial = mergeInitialValues<T>(schemaDefaults, options.initialValues);

	// =========================================================================
	// Core State ($state)
	// =========================================================================

	// Use JSON clone to handle potential Svelte 5 reactive proxies
	let values = $state<T>(JSON.parse(JSON.stringify(initial)) as T);
	let errors = $state<Record<string, string>>({});
	let warnings = $state<Record<string, string>>({});
	let touched = $state<Record<string, boolean>>({});
	let isSubmitting = $state<boolean>(false);
	let isValidating = $state<boolean>(false);
	let isSubmitted = $state<boolean>(false);
	let submitError = $state<Error | null>(null);
	let submitCount = $state<number>(0);

	// Debounce timers for delayError
	const errorTimers = new Map<string, ReturnType<typeof setTimeout>>();

	// =========================================================================
	// Path Caching (Performance Optimization)
	// =========================================================================

	// Cache paths based on structural signature to avoid O(n) traversal on every value change.
	// Paths only need to be recalculated when the object structure changes (keys added/removed,
	// array lengths changed), not when values change.
	let cachedSignature = '';
	let cachedPaths: string[] = [];

	function getCachedPaths(): string[] {
		const currentSignature = getStructuralSignature(values);
		if (currentSignature !== cachedSignature) {
			cachedSignature = currentSignature;
			cachedPaths = getAllPaths(values);
		}
		return cachedPaths;
	}

	// =========================================================================
	// Derived State ($derived)
	// =========================================================================

	// Dirty computation uses cached paths for better performance on large forms.
	const dirty = $derived.by(() => {
		const paths = getCachedPaths();
		return calculateDirtyState(values, initial, paths, getPath);
	});

	const isDirty = $derived(Object.values(dirty).some(Boolean));
	const isValid = $derived(Object.keys(errors).length === 0);

	// =========================================================================
	// Deep Proxy for bind:value
	// =========================================================================

	const proxiedData = createDeepProxy(values, {
		onSet(path, _value) {
			// Mark as touched on set (for 'touched' mode)
			if (mode === 'touched' && !touched[path]) {
				touched[path] = true;
			}

			// Determine if we should validate
			if (shouldValidateField(path, 'change')) {
				void runFieldValidation(path);
			}

			// Always run warners (not affected by mode)
			void runFieldWarner(path);
		}
	});

	// =========================================================================
	// Validation Logic
	// =========================================================================

	/**
	 * Determine if a field should be validated based on mode and event.
	 */
	function shouldValidateField(field: string, event: 'change' | 'blur'): boolean {
		return shouldValidate({
			field,
			event,
			mode,
			revalidateMode,
			hasError: field in errors,
			isSubmitted,
			isTouched: touched[field] ?? false
		});
	}

	/**
	 * Run validation for a single field.
	 */
	async function runFieldValidation(field: string): Promise<boolean> {
		// Run schema validation
		let fieldError: string | undefined;

		if (schema) {
			const result = await validateSchemaAsync(schema as StandardSchema<T>, values);
			fieldError = result.errors[field];
		}

		// Run custom validator if no schema error
		if (!fieldError && validators) {
			const validator = (validators as Record<string, FieldValidator<T>>)[field];
			if (validator) {
				const fieldValue = getPath(values, field);
				fieldError = await validator(fieldValue, values);
			}
		}

		// Update error state (with debouncing if configured)
		if (fieldError) {
			setErrorWithDelay(field, fieldError);
		} else {
			clearFieldError(field);
		}

		return !fieldError;
	}

	/**
	 * Run warner for a single field.
	 */
	async function runFieldWarner(field: string): Promise<void> {
		if (!warners) return;

		const warner = (warners as Record<string, FieldValidator<T>>)[field];
		if (!warner) return;

		const fieldValue = getPath(values, field);
		const warning = await warner(fieldValue, values);

		if (warning) {
			warnings = setKey(warnings, field, warning);
		} else {
			warnings = removeKey(warnings, field);
		}
	}

	/**
	 * Set error with optional delay (debouncing).
	 */
	function setErrorWithDelay(field: string, message: string): void {
		// Clear any existing timer
		const existingTimer = errorTimers.get(field);
		if (existingTimer) {
			clearTimeout(existingTimer);
			errorTimers.delete(field);
		}

		if (delayError <= 0) {
			// No delay - set immediately
			errors = { ...errors, [field]: message };
		} else {
			// Debounce - set after delay
			const timer = setTimeout(() => {
				errors = { ...errors, [field]: message };
				errorTimers.delete(field);
			}, delayError);
			errorTimers.set(field, timer);
		}
	}

	/**
	 * Clear error for a field immediately.
	 */
	function clearFieldError(field: string): void {
		// Clear any pending timer
		const existingTimer = errorTimers.get(field);
		if (existingTimer) {
			clearTimeout(existingTimer);
			errorTimers.delete(field);
		}

		// Clear error immediately
		if (field in errors) {
			const { [field]: _, ...rest } = errors;
			errors = rest;
		}
	}

	/**
	 * Clear all error timers.
	 */
	function clearAllErrorTimers(): void {
		for (const timer of errorTimers.values()) {
			clearTimeout(timer);
		}
		errorTimers.clear();
	}

	// =========================================================================
	// Public Validation Methods
	// =========================================================================

	/**
	 * Validate the entire form.
	 * @returns true if valid, false if errors exist
	 */
	async function validate(): Promise<boolean> {
		isValidating = true;

		try {
			let allErrors: Record<string, string> = {};

			// Run schema validation
			if (schema) {
				const result = await validateSchemaAsync(schema as StandardSchema<T>, values);
				allErrors = { ...result.errors };
			}

			// Run custom validators for all fields
			if (validators) {
				for (const [field, validator] of Object.entries(validators)) {
					if (!allErrors[field] && validator) {
						const fieldValue = getPath(values, field);
						const error = await (validator as FieldValidator<T>)(fieldValue, values);
						if (error) {
							allErrors[field] = error;
						}
					}
				}
			}

			// Update errors state
			errors = allErrors;

			return Object.keys(allErrors).length === 0;
		} finally {
			isValidating = false;
		}
	}

	/**
	 * Validate a single field.
	 * @param field - Field path to validate
	 * @returns true if valid, false if error exists
	 */
	async function validateField(field: string): Promise<boolean> {
		isValidating = true;

		try {
			return await runFieldValidation(field);
		} finally {
			isValidating = false;
		}
	}

	// =========================================================================
	// Form Operations
	// =========================================================================

	/**
	 * Submit the form.
	 * @param event - Optional event to prevent default
	 */
	async function submit(event?: Event): Promise<void> {
		if (event) {
			event.preventDefault();
		}

		isSubmitted = true;
		submitCount = submitCount + 1;
		submitError = null;

		// Run full validation
		const valid = await validate();

		if (!valid) {
			return;
		}

		isSubmitting = true;

		try {
			await onSubmit(values);
		} catch (e) {
			submitError = e instanceof Error ? e : new Error(String(e));
			reportError('forms:submit', submitError, {
				handledLocally: true,
				showUI: false
			});
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * Reset the form to initial state.
	 * @param newValues - Optional new values to merge with initial
	 */
	function reset(newValues?: Partial<T>): void {
		// Clear all timers
		clearAllErrorTimers();

		// Reset values by mutating in place (keeps proxy reference valid)
		// Use JSON clone to handle potential Svelte 5 reactive proxies
		const resetValues = newValues
			? JSON.parse(JSON.stringify({ ...initial, ...newValues }))
			: JSON.parse(JSON.stringify(initial));

		// Clear existing keys and copy new values
		for (const key of Object.keys(values)) {
			delete (values as Record<string, unknown>)[key];
		}
		Object.assign(values, resetValues);

		// Reset all state
		errors = {};
		warnings = {};
		touched = {};
		isSubmitting = false;
		isValidating = false;
		isSubmitted = false;
		submitError = null;
		submitCount = 0;
	}

	// =========================================================================
	// Field Operations
	// =========================================================================

	/**
	 * Set a field value with type safety.
	 * Mutates in place to maintain proxy reference.
	 */
	function setField<K extends keyof T>(field: K, value: T[K]): void {
		const path = String(field);
		const parts = path.split('.');

		if (parts.length === 1) {
			// Top-level field - direct assignment
			(values as Record<string, unknown>)[path] = value;
		} else {
			// Nested field - navigate to parent and set
			let current: Record<string, unknown> = values as Record<string, unknown>;
			for (let i = 0; i < parts.length - 1; i++) {
				current = current[parts[i]] as Record<string, unknown>;
			}
			current[parts[parts.length - 1]] = value;
		}
	}

	/**
	 * Set an error for a field.
	 * @param field - Field path
	 * @param message - Error message (null to clear)
	 */
	function setError(field: string, message: string | null): void {
		if (message === null) {
			clearFieldError(field);
		} else {
			errors = { ...errors, [field]: message };
		}
	}

	/**
	 * Set a warning for a field.
	 * @param field - Field path
	 * @param message - Warning message (null to clear)
	 */
	function setWarning(field: string, message: string | null): void {
		if (message === null) {
			warnings = removeKey(warnings, field);
		} else {
			warnings = setKey(warnings, field, message);
		}
	}

	/**
	 * Mark a field as touched and trigger blur validation.
	 */
	function touch(field: string): void {
		touched = { ...touched, [field]: true };

		// Trigger blur validation if applicable
		if (shouldValidateField(field, 'blur')) {
			void runFieldValidation(field);
		}
	}

	/**
	 * Clear all errors and warnings.
	 */
	function clearErrors(): void {
		clearAllErrorTimers();
		errors = {};
		warnings = {};
	}

	// =========================================================================
	// Array Operations
	// =========================================================================

	/**
	 * Push a value to the end of an array field.
	 */
	function push(field: string, value: unknown): void {
		const arr = getPath(values, field);
		if (!Array.isArray(arr)) {
			throw new Error(`Field "${field}" is not an array`);
		}
		arr.push(value);
	}

	/**
	 * Remove an item from an array field.
	 */
	function remove(field: string, index: number): void {
		const arr = getPath(values, field);
		if (!Array.isArray(arr)) {
			throw new Error(`Field "${field}" is not an array`);
		}
		arr.splice(index, 1);
		reindexArrayErrors(field, index, -1);
	}

	/**
	 * Insert an item into an array field at a specific index.
	 */
	function insert(field: string, index: number, value: unknown): void {
		const arr = getPath(values, field);
		if (!Array.isArray(arr)) {
			throw new Error(`Field "${field}" is not an array`);
		}
		arr.splice(index, 0, value);
		reindexArrayErrors(field, index, 1);
	}

	/**
	 * Move an item within an array field.
	 */
	function move(field: string, from: number, to: number): void {
		const arr = getPath(values, field);
		if (!Array.isArray(arr)) {
			throw new Error(`Field "${field}" is not an array`);
		}
		const [item] = arr.splice(from, 1);
		arr.splice(to, 0, item);
	}

	/**
	 * Swap two items within an array field.
	 */
	function swap(field: string, indexA: number, indexB: number): void {
		const arr = getPath(values, field);
		if (!Array.isArray(arr)) {
			throw new Error(`Field "${field}" is not an array`);
		}
		[arr[indexA], arr[indexB]] = [arr[indexB], arr[indexA]];
	}

	/**
	 * Reindex error keys after array modification.
	 */
	function reindexArrayErrors(field: string, fromIndex: number, delta: number): void {
		errors = reindexErrors(errors, field, fromIndex, delta);
	}

	// =========================================================================
	// Field-centric Access
	// =========================================================================

	/**
	 * Get a field-centric view of a specific field.
	 * @param path - Field path
	 * @returns FieldState with reactive getters
	 */
	function field<V = unknown>(path: string): FieldState<V> {
		return {
			get value() {
				return getPath(values, path) as V;
			},
			get error() {
				return errors[path];
			},
			get warning() {
				return warnings[path];
			},
			get touched() {
				return touched[path] ?? false;
			},
			get dirty() {
				return dirty[path] ?? false;
			}
		};
	}

	// =========================================================================
	// Return (with getters for reactivity)
	// =========================================================================

	/**
	 * Clean up form resources (error timers).
	 * Call this when the component unmounts to prevent memory leaks.
	 */
	function cleanup(): void {
		clearAllErrorTimers();
	}

	return {
		get data() {
			return proxiedData;
		},
		get errors() {
			return errors;
		},
		get warnings() {
			return warnings;
		},
		get touched() {
			return touched;
		},
		get dirty() {
			return dirty;
		},
		get isValid() {
			return isValid;
		},
		get isDirty() {
			return isDirty;
		},
		get isSubmitting() {
			return isSubmitting;
		},
		get isValidating() {
			return isValidating;
		},
		get isSubmitted() {
			return isSubmitted;
		},
		get submitError() {
			return submitError;
		},
		get submitCount() {
			return submitCount;
		},
		submit,
		reset,
		validate,
		validateField,
		setField,
		setError,
		setWarning,
		touch,
		clearErrors,
		push,
		remove,
		insert,
		move,
		swap,
		field,
		cleanup
	};
}
