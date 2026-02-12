/**
 * @warpkit/forms - Schema-driven form state management for Svelte 5
 *
 * Provides a powerful form state management solution with:
 * - Deep proxy for transparent bind:value support
 * - StandardSchema validation integration
 * - Svelte 5 runes for reactivity
 * - Array field operations with error reindexing
 * - Field-centric access via form.field('path')
 *
 * @module @warpkit/forms
 *
 * @example
 * ```svelte
 * <script>
 *   import { useForm } from '@warpkit/forms';
 *
 *   const form = useForm({
 *     initialValues: { email: '', password: '' },
 *     onSubmit: async (values) => {
 *       await api.login(values);
 *     }
 *   });
 * </script>
 *
 * <form onsubmit={form.submit}>
 *   <input bind:value={form.data.email} />
 *   <input type="password" bind:value={form.data.password} />
 *   <button type="submit">Submit</button>
 * </form>
 * ```
 */

// Main hook
export { useForm } from './hooks.svelte';

// Types
export type {
	FormOptions,
	FormState,
	FormErrors,
	FieldPath,
	ValidationMode,
	RevalidateMode,
	FieldValidator,
	FieldState
} from './types';

// Proxy utilities
export { createDeepProxy } from './proxy';
export type { ProxyOptions } from './proxy';

// Validation utilities
export { validateSchema, validateSchemaAsync, shouldValidate, createErrorDebouncer } from './validation';
export type { ValidationResult, ErrorDebouncer } from './validation';

// Default extraction
export { extractDefaults } from './defaults';
export type { TypeBoxSchemaLike } from './defaults';

// Path utilities
export { getPath, setPath, pathToString, getAllPaths } from './paths';
