import type { TypeDefinition as TypeDefinitionInterface } from './types';

/**
 * Factory for creating type-only definitions (no schema).
 * Use when you need a keyed type for type inference without runtime validation.
 *
 * @example
 * ```typescript
 * const UserType = TypeDefinition.create<User>('user');
 * // typeof UserType._data === User
 * ```
 */
export const TypeDefinition = {
	/**
	 * Create a type-only definition.
	 *
	 * @template T - The type to carry
	 * @param key - Unique identifier for this type
	 * @returns Frozen TypeDefinition<T>
	 */
	create<T>(key: string): TypeDefinitionInterface<T> {
		return Object.freeze({
			key,
			_data: undefined as unknown as T
		});
	}
};
