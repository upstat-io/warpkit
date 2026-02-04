import type { StandardSchema } from './standard-schema';
import type { TypeDefinition, ValidatedType as ValidatedTypeInterface } from './types';
import { ValidationError } from './errors';

/**
 * Validate data against a StandardSchema.
 * Returns the validated data on success, throws ValidationError on failure.
 *
 * @template T - The expected output type
 * @param schema - Schema implementing StandardSchema interface
 * @param data - Unknown data to validate
 * @returns Validated data of type T
 * @throws {ValidationError} When validation fails
 *
 * @example
 * ```typescript
 * import { Type } from '@sinclair/typebox';
 *
 * const UserSchema = Type.Object({ name: Type.String() });
 *
 * try {
 *   const user = validate(UserSchema, { name: 'Alice' });
 *   // user is typed as { name: string }
 * } catch (e) {
 *   if (e instanceof ValidationError) {
 *     console.error(e.issues);
 *   }
 * }
 * ```
 */
export function validate<T>(schema: StandardSchema<T>, data: unknown): T {
	const result = schema['~standard'].validate(data);

	// Handle async schemas - throw if Promise returned (use validateAsync instead)
	if (result instanceof Promise) {
		throw new Error('Schema returned a Promise. Use validateAsync() for async schemas.');
	}

	if ('issues' in result) {
		throw new ValidationError(result.issues);
	}

	return result.value;
}

/**
 * Type guard to check if a TypeDefinition has a schema (is a ValidatedType).
 *
 * @template T - The type parameter
 * @param def - TypeDefinition to check
 * @returns True if the definition has a schema property
 *
 * @example
 * ```typescript
 * const typeDef = TypeDefinition.create<User>('user');
 * const validatedDef = ValidatedType.wrap('user', UserSchema);
 *
 * isValidatedType(typeDef);     // false
 * isValidatedType(validatedDef); // true
 * ```
 */
export function isValidatedType<T>(def: TypeDefinition<T>): def is ValidatedTypeInterface<T> {
	return typeof def === 'object' && def !== null && 'schema' in def;
}
