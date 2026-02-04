// Standard Schema types
export type { StandardSchema, StandardResult, StandardIssue, StandardInfer } from './standard-schema';
export { isStandardSchema } from './standard-schema';

// Re-export types and factories
// TypeScript merges these - use `import { ValidatedType }` for factory,
// `import type { ValidatedType }` for type-only
import { TypeDefinition as TypeDefinitionFactory } from './type-definition';
import { ValidatedType as ValidatedTypeFactory } from './validated-type';
import type { TypeDefinition as TypeDefinitionType, ValidatedType as ValidatedTypeType } from './types';

// Export merged type+value (TypeScript declaration merging)
export const TypeDefinition = TypeDefinitionFactory;
export type TypeDefinition<T> = TypeDefinitionType<T>;

export const ValidatedType = ValidatedTypeFactory;
export type ValidatedType<T> = ValidatedTypeType<T>;

// Validation utilities
export { validate, validateAsync, isValidatedType } from './validate';

// Errors
export { ValidationError } from './errors';
