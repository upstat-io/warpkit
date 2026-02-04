import type { StandardSchema } from './standard-schema';

/**
 * A named type definition with a type carrier.
 * The _data property carries the type T at compile time but is undefined at runtime.
 */
export type TypeDefinition<T> = {
	readonly key: string;
	readonly _data: T;
};

/**
 * A TypeDefinition with an attached validation schema.
 * Used to define message types that can be validated at runtime.
 */
export type ValidatedType<T> = TypeDefinition<T> & {
	readonly schema: StandardSchema<T>;
};
