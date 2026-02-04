import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StandardSchema, StandardResult } from '@warpkit/validation';
import { validateSchema, validateSchemaAsync, shouldValidate, createErrorDebouncer } from './validation';

// Helper to create a mock StandardSchema
function createMockSchema<T>(
	validateFn: (value: T) => StandardResult<T> | Promise<StandardResult<T>>
): StandardSchema<T> {
	return {
		'~standard': {
			version: 1,
			vendor: 'test',
			validate: validateFn
		}
	} as StandardSchema<T>;
}

describe('validateSchema', () => {
	describe('with valid input', () => {
		it('returns valid result for passing validation', () => {
			const schema = createMockSchema<{ name: string }>(() => ({
				value: { name: 'John' }
			}));

			const result = validateSchema(schema, { name: 'John' });

			expect(result).toEqual({ valid: true, errors: {} });
		});

		it('returns valid result when schema is undefined', () => {
			const result = validateSchema(undefined, { name: 'John' });

			expect(result).toEqual({ valid: true, errors: {} });
		});
	});

	describe('with invalid input', () => {
		it('returns errors mapped by path', () => {
			const schema = createMockSchema<{ email: string }>(() => ({
				issues: [{ path: ['email'], message: 'Invalid email format' }]
			}));

			const result = validateSchema(schema, { email: 'invalid' });

			expect(result).toEqual({
				valid: false,
				errors: { email: 'Invalid email format' }
			});
		});

		it('uses _root for errors without path', () => {
			const schema = createMockSchema<{ name: string }>(() => ({
				issues: [{ message: 'Root level error' }]
			}));

			const result = validateSchema(schema, { name: '' });

			expect(result).toEqual({
				valid: false,
				errors: { _root: 'Root level error' }
			});
		});

		it('uses _root for errors with empty path', () => {
			const schema = createMockSchema<{ name: string }>(() => ({
				issues: [{ path: [], message: 'Root level error' }]
			}));

			const result = validateSchema(schema, { name: '' });

			expect(result).toEqual({
				valid: false,
				errors: { _root: 'Root level error' }
			});
		});

		it('handles nested path errors', () => {
			const schema = createMockSchema<{ user: { email: string } }>(() => ({
				issues: [{ path: ['user', 'email'], message: 'Invalid email' }]
			}));

			const result = validateSchema(schema, { user: { email: 'bad' } });

			expect(result).toEqual({
				valid: false,
				errors: { 'user.email': 'Invalid email' }
			});
		});

		it('handles array index paths', () => {
			const schema = createMockSchema<{ items: string[] }>(() => ({
				issues: [{ path: ['items', 0], message: 'Item 0 is invalid' }]
			}));

			const result = validateSchema(schema, { items: ['bad'] });

			expect(result).toEqual({
				valid: false,
				errors: { 'items.0': 'Item 0 is invalid' }
			});
		});

		it('keeps only first error for each path', () => {
			const schema = createMockSchema<{ email: string }>(() => ({
				issues: [
					{ path: ['email'], message: 'First error' },
					{ path: ['email'], message: 'Second error' }
				]
			}));

			const result = validateSchema(schema, { email: 'bad' });

			expect(result).toEqual({
				valid: false,
				errors: { email: 'First error' }
			});
		});

		it('handles multiple fields with errors', () => {
			const schema = createMockSchema<{ name: string; email: string }>(() => ({
				issues: [
					{ path: ['name'], message: 'Name required' },
					{ path: ['email'], message: 'Email required' }
				]
			}));

			const result = validateSchema(schema, { name: '', email: '' });

			expect(result).toEqual({
				valid: false,
				errors: {
					name: 'Name required',
					email: 'Email required'
				}
			});
		});
	});

	describe('async schema detection', () => {
		it('throws error when schema returns Promise', () => {
			const schema = createMockSchema<{ name: string }>(() => Promise.resolve({ value: { name: 'John' } }));

			expect(() => validateSchema(schema, { name: 'John' })).toThrow(
				'Schema returned a Promise. Use validateSchemaAsync() for async schemas.'
			);
		});
	});
});

describe('validateSchemaAsync', () => {
	it('handles async validation', async () => {
		const schema = createMockSchema<{ name: string }>(() => Promise.resolve({ value: { name: 'John' } }));

		const result = await validateSchemaAsync(schema, { name: 'John' });

		expect(result).toEqual({ valid: true, errors: {} });
	});

	it('handles async validation errors', async () => {
		const schema = createMockSchema<{ email: string }>(() =>
			Promise.resolve({
				issues: [{ path: ['email'], message: 'Email already taken' }]
			})
		);

		const result = await validateSchemaAsync(schema, {
			email: 'taken@example.com'
		});

		expect(result).toEqual({
			valid: false,
			errors: { email: 'Email already taken' }
		});
	});

	it('handles sync schemas in async function', async () => {
		const schema = createMockSchema<{ name: string }>(() => ({
			value: { name: 'John' }
		}));

		const result = await validateSchemaAsync(schema, { name: 'John' });

		expect(result).toEqual({ valid: true, errors: {} });
	});

	it('returns valid when schema is undefined', async () => {
		const result = await validateSchemaAsync(undefined, { name: 'John' });

		expect(result).toEqual({ valid: true, errors: {} });
	});

	it('handles nested path errors in async', async () => {
		const schema = createMockSchema<{ user: { name: string } }>(() =>
			Promise.resolve({
				issues: [{ path: ['user', 'name'], message: 'Name too short' }]
			})
		);

		const result = await validateSchemaAsync(schema, { user: { name: 'A' } });

		expect(result).toEqual({
			valid: false,
			errors: { 'user.name': 'Name too short' }
		});
	});
});

describe('shouldValidate', () => {
	describe('submit mode', () => {
		it('validates only on submit', () => {
			expect(shouldValidate('submit', 'submit')).toBe(true);
			expect(shouldValidate('submit', 'blur')).toBe(false);
			expect(shouldValidate('submit', 'change')).toBe(false);
		});
	});

	describe('blur mode', () => {
		it('validates on blur and submit', () => {
			expect(shouldValidate('blur', 'submit')).toBe(true);
			expect(shouldValidate('blur', 'blur')).toBe(true);
			expect(shouldValidate('blur', 'change')).toBe(false);
		});
	});

	describe('change mode', () => {
		it('validates on all events', () => {
			expect(shouldValidate('change', 'submit')).toBe(true);
			expect(shouldValidate('change', 'blur')).toBe(true);
			expect(shouldValidate('change', 'change')).toBe(true);
		});
	});

	describe('touched mode', () => {
		it('validates on blur and submit (same as blur for triggering)', () => {
			expect(shouldValidate('touched', 'submit')).toBe(true);
			expect(shouldValidate('touched', 'blur')).toBe(true);
			expect(shouldValidate('touched', 'change')).toBe(false);
		});
	});

	describe('unknown mode', () => {
		it('returns false for unknown modes', () => {
			expect(shouldValidate('unknown' as never, 'submit')).toBe(false);
			expect(shouldValidate('unknown' as never, 'blur')).toBe(false);
			expect(shouldValidate('unknown' as never, 'change')).toBe(false);
		});
	});
});

describe('createErrorDebouncer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('with no delay (default 0)', () => {
		it('sets errors immediately', () => {
			const debouncer = createErrorDebouncer(0);

			debouncer.set('email', 'Invalid email');

			expect(debouncer.getErrors()).toEqual({ email: 'Invalid email' });
		});

		it('clears errors immediately', () => {
			const debouncer = createErrorDebouncer(0);
			debouncer.set('email', 'Invalid email');

			debouncer.clear('email');

			expect(debouncer.getErrors()).toEqual({});
		});
	});

	describe('with delay', () => {
		it('delays error setting', () => {
			const debouncer = createErrorDebouncer(300);

			debouncer.set('email', 'Invalid email');

			expect(debouncer.getErrors()).toEqual({});

			vi.advanceTimersByTime(300);

			expect(debouncer.getErrors()).toEqual({ email: 'Invalid email' });
		});

		it('clears error immediately even if pending', () => {
			const debouncer = createErrorDebouncer(300);

			debouncer.set('email', 'Invalid email');
			debouncer.clear('email');

			vi.advanceTimersByTime(300);

			expect(debouncer.getErrors()).toEqual({});
		});

		it('clears existing error immediately', () => {
			const debouncer = createErrorDebouncer(0);
			debouncer.set('email', 'Invalid email');

			const debouncerWithDelay = createErrorDebouncer(300);
			debouncerWithDelay.set('email', 'Invalid email');
			vi.advanceTimersByTime(300);

			debouncerWithDelay.clear('email');

			expect(debouncerWithDelay.getErrors()).toEqual({});
		});
	});

	describe('clearAll', () => {
		it('clears all errors', () => {
			const debouncer = createErrorDebouncer(0);
			debouncer.set('email', 'Invalid email');
			debouncer.set('name', 'Name required');

			debouncer.clearAll();

			expect(debouncer.getErrors()).toEqual({});
		});

		it('cancels all pending timers', () => {
			const debouncer = createErrorDebouncer(300);
			debouncer.set('email', 'Invalid email');
			debouncer.set('name', 'Name required');

			debouncer.clearAll();
			vi.advanceTimersByTime(300);

			expect(debouncer.getErrors()).toEqual({});
		});

		it('clears both committed and pending errors', () => {
			const debouncer = createErrorDebouncer(300);

			// Set one error immediately
			debouncer.set('email', 'Invalid');
			vi.advanceTimersByTime(300);

			// Set another pending
			debouncer.set('name', 'Required');

			debouncer.clearAll();
			vi.advanceTimersByTime(300);

			expect(debouncer.getErrors()).toEqual({});
		});
	});

	describe('rapid successive calls', () => {
		it('debounces rapid error updates', () => {
			const debouncer = createErrorDebouncer(300);

			debouncer.set('email', 'Error 1');
			vi.advanceTimersByTime(100);
			debouncer.set('email', 'Error 2');
			vi.advanceTimersByTime(100);
			debouncer.set('email', 'Error 3');

			// Not yet committed
			expect(debouncer.getErrors()).toEqual({});

			vi.advanceTimersByTime(300);

			// Only last error is committed
			expect(debouncer.getErrors()).toEqual({ email: 'Error 3' });
		});

		it('handles multiple fields independently', () => {
			const debouncer = createErrorDebouncer(300);

			debouncer.set('email', 'Email error');
			vi.advanceTimersByTime(150);
			debouncer.set('name', 'Name error');

			vi.advanceTimersByTime(150);
			// email timer done, name still pending
			expect(debouncer.getErrors()).toEqual({ email: 'Email error' });

			vi.advanceTimersByTime(150);
			expect(debouncer.getErrors()).toEqual({
				email: 'Email error',
				name: 'Name error'
			});
		});
	});

	describe('getErrors', () => {
		it('returns a copy of errors', () => {
			const debouncer = createErrorDebouncer(0);
			debouncer.set('email', 'Invalid email');

			const errors1 = debouncer.getErrors();
			const errors2 = debouncer.getErrors();

			expect(errors1).toEqual(errors2);
			expect(errors1).not.toBe(errors2); // Different object references
		});

		it('returned object is not affected by further changes', () => {
			const debouncer = createErrorDebouncer(0);
			debouncer.set('email', 'Invalid email');

			const errors = debouncer.getErrors();
			debouncer.set('name', 'Name required');

			expect(errors).toEqual({ email: 'Invalid email' });
		});
	});
});
