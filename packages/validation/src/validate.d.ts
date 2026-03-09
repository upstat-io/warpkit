import type { StandardSchema } from './standard-schema';
import type { TypeDefinition, ValidatedType as ValidatedTypeInterface } from './types';
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
export declare function validate<T>(schema: StandardSchema<T>, data: unknown): T;
/**
 * Validate data against a StandardSchema asynchronously.
 * Supports both sync and async schemas.
 * Returns the validated data on success, throws ValidationError on failure.
 *
 * @template T - The expected output type
 * @param schema - Schema implementing StandardSchema interface
 * @param data - Unknown data to validate
 * @returns Promise resolving to validated data of type T
 * @throws {ValidationError} When validation fails
 *
 * @example
 * ```typescript
 * import { Type } from '@sinclair/typebox';
 *
 * const UserSchema = Type.Object({ name: Type.String() });
 *
 * try {
 *   const user = await validateAsync(UserSchema, { name: 'Alice' });
 *   // user is typed as { name: string }
 * } catch (e) {
 *   if (e instanceof ValidationError) {
 *     console.error(e.issues);
 *   }
 * }
 * ```
 */
export declare function validateAsync<T>(schema: StandardSchema<T>, data: unknown): Promise<T>;
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
export declare function isValidatedType<T>(def: TypeDefinition<T>): def is ValidatedTypeInterface<T>;
