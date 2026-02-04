/**
 * isStandardSchema() unit tests
 */
import { describe, it, expect } from 'vitest';
import { isStandardSchema } from './standard-schema';
import type { StandardSchema } from './standard-schema';

describe('isStandardSchema()', () => {
	it('should return true for valid StandardSchema objects', () => {
		const schema: StandardSchema<string> = {
			'~standard': {
				version: 1,
				vendor: 'test',
				validate: (value: unknown) => ({ value: value as string })
			}
		};

		expect(isStandardSchema(schema)).toBe(true);
	});

	it('should return false for null', () => {
		expect(isStandardSchema(null)).toBe(false);
	});

	it('should return false for undefined', () => {
		expect(isStandardSchema(undefined)).toBe(false);
	});

	it('should return false for plain objects', () => {
		expect(isStandardSchema({})).toBe(false);
		expect(isStandardSchema({ foo: 'bar' })).toBe(false);
	});

	it('should return false for primitives', () => {
		expect(isStandardSchema('string')).toBe(false);
		expect(isStandardSchema(123)).toBe(false);
		expect(isStandardSchema(true)).toBe(false);
	});

	it('should return false for arrays', () => {
		expect(isStandardSchema([])).toBe(false);
		expect(isStandardSchema([1, 2, 3])).toBe(false);
	});

	it('should return true for objects with ~standard property regardless of content', () => {
		// The type guard only checks for presence of ~standard, not its shape
		const partialSchema = {
			'~standard': {}
		};

		expect(isStandardSchema(partialSchema)).toBe(true);
	});
});
