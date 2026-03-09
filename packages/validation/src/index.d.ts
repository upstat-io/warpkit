export type { StandardSchema, StandardResult, StandardIssue, StandardInfer } from './standard-schema';
export { isStandardSchema } from './standard-schema';
import type { TypeDefinition as TypeDefinitionType, ValidatedType as ValidatedTypeType } from './types';
export declare const TypeDefinition: {
    create<T>(key: string): TypeDefinitionType<T>;
};
export type TypeDefinition<T> = TypeDefinitionType<T>;
export declare const ValidatedType: {
    wrap<TSchema extends import("./standard-schema").StandardSchema>(key: string, schema: TSchema): ValidatedTypeType<import("./standard-schema").StandardInfer<TSchema>>;
    unwrap<T>(validated: ValidatedTypeType<T>): import("./standard-schema").StandardSchema<T>;
};
export type ValidatedType<T> = ValidatedTypeType<T>;
export { validate, validateAsync, isValidatedType } from './validate';
export { ValidationError } from './errors';
