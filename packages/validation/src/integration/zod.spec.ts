/**
 * Zod Integration Tests
 *
 * Verifies @warpkit/validation works with real Zod schemas.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { isStandardSchema, ValidatedType, validate, ValidationError } from '../index';

describe('Zod Integration', () => {
	const UserSchema = z.object({
		name: z.string(),
		age: z.number()
	});

	describe('isStandardSchema', () => {
		it('should recognize Zod schema as StandardSchema', () => {
			expect(isStandardSchema(UserSchema)).toBe(true);
		});

		it('should recognize nested Zod schemas', () => {
			const NestedSchema = z.object({
				user: UserSchema,
				tags: z.array(z.string())
			});
			expect(isStandardSchema(NestedSchema)).toBe(true);
		});
	});

	describe('validate', () => {
		it('should return validated data for valid input', () => {
			const data = { name: 'Alice', age: 30 };
			const result = validate(UserSchema, data);

			expect(result).toEqual(data);
		});

		it('should throw ValidationError for missing required field', () => {
			const data = { name: 'Alice' }; // missing age

			expect(() => validate(UserSchema, data)).toThrow(ValidationError);
		});

		it('should throw ValidationError for wrong type', () => {
			const data = { name: 'Alice', age: 'thirty' }; // age should be number

			expect(() => validate(UserSchema, data)).toThrow(ValidationError);
		});

		it('should include issues in ValidationError', () => {
			const data = { name: 123, age: 'wrong' }; // both fields wrong

			try {
				validate(UserSchema, data);
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err).toBeInstanceOf(ValidationError);
				const error = err as ValidationError;
				expect(error.issues.length).toBeGreaterThan(0);
			}
		});

		it('should include path in validation issues', () => {
			const data = { name: 'Alice', age: 'thirty' };

			try {
				validate(UserSchema, data);
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err).toBeInstanceOf(ValidationError);
				const error = err as ValidationError;
				// Zod should include path to the invalid field
				expect(error.issues.some((issue) => issue.path !== undefined)).toBe(true);
			}
		});

		it('should validate nested objects', () => {
			const AddressSchema = z.object({
				street: z.string(),
				city: z.string()
			});

			const PersonSchema = z.object({
				name: z.string(),
				address: AddressSchema
			});

			const validData = {
				name: 'Alice',
				address: { street: '123 Main St', city: 'Boston' }
			};

			const result = validate(PersonSchema, validData);
			expect(result).toEqual(validData);
		});

		it('should validate arrays', () => {
			const TagsSchema = z.array(z.string());

			const validData = ['tag1', 'tag2', 'tag3'];
			const result = validate(TagsSchema, validData);
			expect(result).toEqual(validData);
		});

		it('should validate optional fields', () => {
			const OptionalSchema = z.object({
				required: z.string(),
				optional: z.string().optional()
			});

			const withOptional = { required: 'yes', optional: 'also' };
			const withoutOptional = { required: 'yes' };

			expect(validate(OptionalSchema, withOptional)).toEqual(withOptional);
			expect(validate(OptionalSchema, withoutOptional)).toEqual(withoutOptional);
		});
	});

	describe('ValidatedType', () => {
		it('should wrap Zod schema with key', () => {
			const validatedType = ValidatedType.wrap('user', UserSchema);

			expect(validatedType.key).toBe('user');
			expect(validatedType.schema).toBe(UserSchema);
		});

		it('should unwrap to original schema', () => {
			const validatedType = ValidatedType.wrap('user', UserSchema);
			const unwrapped = ValidatedType.unwrap(validatedType);

			// The unwrapped schema should work for validation
			const result = validate(unwrapped, { name: 'Alice', age: 25 });
			expect(result).toEqual({ name: 'Alice', age: 25 });
		});

		it('should preserve type inference', () => {
			const validatedType = ValidatedType.wrap('user', UserSchema);

			// Type check - validatedType._data should be { name: string, age: number }
			type ExpectedType = { name: string; age: number };
			const _typeCheck: ExpectedType = validatedType._data;
			void _typeCheck; // suppress unused warning

			// Runtime check
			expect(validatedType._data).toBeUndefined();
		});
	});
});
