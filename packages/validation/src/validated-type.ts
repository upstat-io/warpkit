import type { StandardSchema, StandardInfer } from './standard-schema';
import type { ValidatedType as ValidatedTypeInterface } from './types';

/**
 * Factory for creating validated type definitions with schemas.
 * Use when you need runtime validation capability.
 *
 * @example
 * ```typescript
 * import { Type } from '@sinclair/typebox';
 *
 * const UserSchema = Type.Object({ name: Type.String() });
 * const UserType = ValidatedType.wrap('user', UserSchema);
 *
 * // Later, extract schema for validation
 * const schema = ValidatedType.unwrap(UserType);
 * ```
 */
export const ValidatedType = {
	/**
	 * Wrap a schema with a key to create a typed definition.
	 *
	 * @template TSchema - The schema type (must implement StandardSchema)
	 * @param key - Unique identifier for this type
	 * @param schema - Schema implementing StandardSchema interface
	 * @returns Frozen ValidatedType<T>
	 */
	wrap<TSchema extends StandardSchema>(
		key: string,
		schema: TSchema
	): ValidatedTypeInterface<StandardInfer<TSchema>> {
		return Object.freeze({
			key,
			schema: schema as StandardSchema<StandardInfer<TSchema>>,
			_data: undefined as unknown as StandardInfer<TSchema>
		});
	},

	/**
	 * Extract the schema from a ValidatedType.
	 *
	 * @template T - The validated type
	 * @param validated - The ValidatedType to unwrap
	 * @returns The underlying StandardSchema
	 */
	unwrap<T>(validated: ValidatedTypeInterface<T>): StandardSchema<T> {
		return validated.schema;
	}
};
