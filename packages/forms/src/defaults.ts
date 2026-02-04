/**
 * @warpkit/forms Default Value Extraction
 *
 * Extracts default values from TypeBox schemas.
 * Enables auto-population of form initial values from schema definitions.
 *
 * **IMPORTANT: TypeBox Only**
 *
 * This module ONLY works with TypeBox schemas. Other StandardSchema-compatible
 * validators (Zod, Valibot, ArkType) store defaults differently and are NOT
 * supported by this automatic extraction.
 *
 * For non-TypeBox schemas, provide explicit initialValues to useForm():
 *
 * @example Using Zod (manual defaults required)
 * ```typescript
 * import { z } from 'zod';
 *
 * const schema = z.object({
 *   name: z.string().default(''),
 *   age: z.number().default(0)
 * });
 *
 * // Zod defaults are NOT auto-extracted - provide them explicitly:
 * const form = useForm({
 *   schema,
 *   initialValues: { name: '', age: 0 }
 * });
 * ```
 */

/**
 * TypeBox schema shape with properties we inspect.
 * This is a minimal interface to avoid TypeBox dependency.
 * Works with raw TypeBox schemas (not wrapped in StandardSchema).
 */
export interface TypeBoxSchemaLike {
	default?: unknown;
	properties?: Record<string, TypeBoxSchemaLike>;
	items?: TypeBoxSchemaLike;
	type?: string;
}

/**
 * Extract default values from a TypeBox schema.
 * Returns a partial object with only the fields that have defaults defined.
 *
 * @param schema - TypeBox schema to extract defaults from (or undefined to skip)
 * @returns Partial object with default values
 *
 * @example
 * ```typescript
 * import { Type } from '@sinclair/typebox';
 *
 * const UserSchema = Type.Object({
 *   name: Type.String({ default: '' }),
 *   age: Type.Number({ default: 0 }),
 *   email: Type.String() // no default
 * });
 *
 * const defaults = extractDefaults(UserSchema);
 * // { name: '', age: 0 }
 * ```
 *
 * @example Nested objects
 * ```typescript
 * const FormSchema = Type.Object({
 *   user: Type.Object({
 *     name: Type.String({ default: 'Guest' })
 *   }),
 *   settings: Type.Object({
 *     theme: Type.String({ default: 'light' })
 *   })
 * });
 *
 * const defaults = extractDefaults(FormSchema);
 * // { user: { name: 'Guest' }, settings: { theme: 'light' } }
 * ```
 */
export function extractDefaults<T>(schema: TypeBoxSchemaLike | undefined): Partial<T> {
	if (!schema) {
		return {} as Partial<T>;
	}

	// Use the schema directly (already TypeBoxSchemaLike)
	const schemaObj = schema;

	// If schema itself has a default at root level
	if ('default' in schemaObj && schemaObj.default !== undefined) {
		return schemaObj.default as Partial<T>;
	}

	// For object schemas, recursively extract defaults from properties
	if (schemaObj.properties && typeof schemaObj.properties === 'object') {
		const result: Record<string, unknown> = {};

		for (const [key, propSchema] of Object.entries(schemaObj.properties)) {
			const defaults = extractPropertyDefaults(propSchema);
			if (defaults !== undefined) {
				result[key] = defaults;
			}
		}

		return result as Partial<T>;
	}

	return {} as Partial<T>;
}

/**
 * Extract defaults from a single property schema.
 * Handles nested objects and arrays recursively.
 */
function extractPropertyDefaults(schema: TypeBoxSchemaLike): unknown {
	// Direct default on property
	if ('default' in schema && schema.default !== undefined) {
		return schema.default;
	}

	// Nested object - recursively extract
	if (schema.properties && typeof schema.properties === 'object') {
		const result: Record<string, unknown> = {};
		let hasDefaults = false;

		for (const [key, propSchema] of Object.entries(schema.properties)) {
			const defaults = extractPropertyDefaults(propSchema);
			if (defaults !== undefined) {
				result[key] = defaults;
				hasDefaults = true;
			}
		}

		return hasDefaults ? result : undefined;
	}

	// Array with items schema - check for default on the array
	if (schema.items) {
		// Arrays don't auto-expand item defaults, just check array-level default
		return undefined;
	}

	return undefined;
}
