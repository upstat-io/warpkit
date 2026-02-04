/**
 * Standard Schema interface for library-agnostic validation.
 * Allows TypeBox, Zod, Valibot, and other libraries to work interchangeably.
 * @see https://github.com/standard-schema/standard-schema
 */
export type StandardSchema<T = unknown> = {
	readonly '~standard': {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (value: unknown) => StandardResult<T> | Promise<StandardResult<T>>;
	};
};

/**
 * Result of StandardSchema validation.
 * Either contains the validated value or an array of issues.
 */
export type StandardResult<T> = { readonly value: T } | { readonly issues: ReadonlyArray<StandardIssue> };

/**
 * Validation issue from StandardSchema.
 * Path can contain property keys or library-specific path segments.
 */
export type StandardIssue = {
	readonly message: string;
	readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
};

/**
 * Extract the TypeScript type from a StandardSchema.
 */
export type StandardInfer<T extends StandardSchema> = T extends StandardSchema<infer U> ? U : never;

/**
 * Type guard to check if a value implements StandardSchema.
 */
export function isStandardSchema(value: unknown): value is StandardSchema {
	return typeof value === 'object' && value !== null && '~standard' in value;
}
