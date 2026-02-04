/**
 * validate() and isValidatedType() unit tests
 */
import { describe, it, expect } from 'vitest';
import { validate, isValidatedType } from './validate';
import { ValidationError } from './errors';
import { TypeDefinition } from './type-definition';
import { ValidatedType } from './validated-type';
import type { StandardSchema, StandardIssue } from './standard-schema';

/**
 * Create a mock StandardSchema for testing
 */
function createMockSchema<T>(options?: {
	validData?: T;
	issues?: ReadonlyArray<StandardIssue>;
}): StandardSchema<T> {
	return {
		'~standard': {
			version: 1,
			vendor: 'test',
			validate: (value: unknown) => {
				if (options?.issues) {
					return { issues: options.issues };
				}
				return { value: (options?.validData ?? value) as T };
			}
		}
	};
}

describe('validate()', () => {
	it('should return validated data when validation succeeds', () => {
		const schema = createMockSchema<{ name: string }>({ validData: { name: 'Alice' } });
		const result = validate(schema, { name: 'test-input' });

		expect(result).toEqual({ name: 'Alice' });
	});

	it('should throw ValidationError when validation fails', () => {
		const issues: ReadonlyArray<StandardIssue> = [{ message: 'Invalid value' }];
		const schema = createMockSchema<unknown>({ issues });

		expect(() => validate(schema, 'invalid')).toThrow(ValidationError);
	});

	it('should include all issues in ValidationError', () => {
		const issues: ReadonlyArray<StandardIssue> = [
			{ message: 'First error' },
			{ message: 'Second error' },
			{ message: 'Third error' }
		];
		const schema = createMockSchema<unknown>({ issues });

		try {
			validate(schema, 'invalid');
			expect.fail('Should have thrown');
		} catch (e) {
			expect(e).toBeInstanceOf(ValidationError);
			const error = e as ValidationError;
			expect(error.issues).toHaveLength(3);
			expect(error.issues[0].message).toBe('First error');
			expect(error.issues[1].message).toBe('Second error');
			expect(error.issues[2].message).toBe('Third error');
		}
	});

	it('should preserve issue paths', () => {
		const issues: ReadonlyArray<StandardIssue> = [{ message: 'Nested error', path: ['user', 'address', 0] }];
		const schema = createMockSchema<unknown>({ issues });

		try {
			validate(schema, 'invalid');
			expect.fail('Should have thrown');
		} catch (e) {
			expect(e).toBeInstanceOf(ValidationError);
			const error = e as ValidationError;
			expect(error.issues[0].path).toEqual(['user', 'address', 0]);
		}
	});
});

describe('ValidationError', () => {
	it('should have correct name property', () => {
		const error = new ValidationError([{ message: 'test' }]);
		expect(error.name).toBe('ValidationError');
	});

	it('should auto-generate message from issues', () => {
		const error = new ValidationError([{ message: 'First' }, { message: 'Second' }]);
		expect(error.message).toBe('Validation failed: First, Second');
	});

	it('should work with empty issues array', () => {
		const error = new ValidationError([]);
		expect(error.issues).toHaveLength(0);
		expect(error.message).toBe('Validation failed: ');
	});

	it('should be an instance of Error', () => {
		const error = new ValidationError([{ message: 'test' }]);
		expect(error).toBeInstanceOf(Error);
	});
});

describe('isValidatedType()', () => {
	it('should return true for ValidatedType', () => {
		const schema = createMockSchema<{ id: string }>();
		const validated = ValidatedType.wrap('test', schema);

		expect(isValidatedType(validated)).toBe(true);
	});

	it('should return false for TypeDefinition', () => {
		const def = TypeDefinition.create<{ id: string }>('test');

		expect(isValidatedType(def)).toBe(false);
	});

	it('should return false for plain objects with key and _data but no schema', () => {
		const plainObj = { key: 'test', _data: undefined };

		// Cast to TypeDefinition to test the guard
		expect(isValidatedType(plainObj as ReturnType<typeof TypeDefinition.create>)).toBe(false);
	});
});
