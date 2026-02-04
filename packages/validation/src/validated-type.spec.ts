/**
 * ValidatedType unit tests
 */
import { describe, it, expect } from 'vitest';
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

describe('ValidatedType', () => {
	describe('wrap()', () => {
		it('should create a ValidatedType with the given key and schema', () => {
			const schema = createMockSchema<{ id: string }>();
			const validated = ValidatedType.wrap('test.key', schema);

			expect(validated.key).toBe('test.key');
			expect(validated.schema).toBe(schema);
		});

		it('should create a frozen ValidatedType', () => {
			const schema = createMockSchema<unknown>();
			const validated = ValidatedType.wrap('test.key', schema);

			expect(Object.isFrozen(validated)).toBe(true);
		});

		it('should have undefined _data (type carrier only)', () => {
			const schema = createMockSchema<{ count: number }>();
			const validated = ValidatedType.wrap('test.typed', schema);

			expect(validated._data).toBeUndefined();
		});

		it('should create distinct definitions for different keys', () => {
			const schema = createMockSchema<unknown>();
			const validated1 = ValidatedType.wrap('key.one', schema);
			const validated2 = ValidatedType.wrap('key.two', schema);

			expect(validated1.key).toBe('key.one');
			expect(validated2.key).toBe('key.two');
			expect(validated1).not.toBe(validated2);
		});
	});

	describe('unwrap()', () => {
		it('should return the schema from a ValidatedType', () => {
			const schema = createMockSchema<{ id: string }>();
			const validated = ValidatedType.wrap('test.key', schema);

			const unwrapped = ValidatedType.unwrap(validated);

			expect(unwrapped).toBe(schema);
		});

		it('should return a schema that can be used for validation', () => {
			const schema = createMockSchema<{ name: string }>({ validData: { name: 'Alice' } });
			const validated = ValidatedType.wrap('user', schema);

			const unwrapped = ValidatedType.unwrap(validated);
			const result = unwrapped['~standard'].validate({ name: 'test' });

			expect('value' in result).toBe(true);
			if ('value' in result) {
				expect(result.value).toEqual({ name: 'Alice' });
			}
		});
	});
});
