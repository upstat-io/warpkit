/**
 * TypeBox Integration Tests
 *
 * NOTE: TypeBox does NOT natively implement StandardSchema (~standard property).
 * TypeBox uses its own validation API (Value.Check, Value.Errors).
 *
 * For TypeBox validation, use @orijs/validation which has native TypeBox support,
 * or use a StandardSchema adapter if one becomes available.
 *
 * These tests document the current behavior and verify our type guard works correctly.
 */
import { describe, it, expect } from 'vitest';
import { Type } from '@sinclair/typebox';
import { isStandardSchema } from '../index';

describe('TypeBox Integration', () => {
	const UserSchema = Type.Object({
		name: Type.String(),
		age: Type.Number()
	});

	describe('isStandardSchema', () => {
		it('should return false for TypeBox schema (TypeBox does not implement StandardSchema)', () => {
			// TypeBox schemas do NOT have the ~standard property
			// They use their own validation API: Value.Check(), Value.Errors()
			expect(isStandardSchema(UserSchema)).toBe(false);
		});

		it('should not have ~standard property on TypeBox schemas', () => {
			expect('~standard' in UserSchema).toBe(false);
		});
	});

	describe('TypeBox Schema Structure', () => {
		it('should have expected JSON Schema structure', () => {
			// TypeBox creates JSON Schema compatible objects
			expect(UserSchema.type).toBe('object');
			expect(UserSchema.properties).toBeDefined();
			expect(UserSchema.properties.name.type).toBe('string');
			expect(UserSchema.properties.age.type).toBe('number');
		});

		it('should have required array for non-optional properties', () => {
			expect(UserSchema.required).toContain('name');
			expect(UserSchema.required).toContain('age');
		});
	});

	/**
	 * To use TypeBox with @warpkit/validation, you would need to:
	 *
	 * 1. Create a StandardSchema adapter:
	 * ```typescript
	 * import { Value } from '@sinclair/typebox/value';
	 *
	 * function toStandardSchema<T>(schema: TSchema): StandardSchema<T> {
	 *   return {
	 *     '~standard': {
	 *       version: 1,
	 *       vendor: 'typebox',
	 *       validate: (value: unknown) => {
	 *         const errors = [...Value.Errors(schema, value)];
	 *         if (errors.length === 0) {
	 *           return { value: Value.Decode(schema, value) as T };
	 *         }
	 *         return {
	 *           issues: errors.map(e => ({ message: e.message, path: e.path.split('/').filter(Boolean) }))
	 *         };
	 *       }
	 *     }
	 *   };
	 * }
	 * ```
	 *
	 * 2. Or use @orijs/validation which has native TypeBox support.
	 */
});
