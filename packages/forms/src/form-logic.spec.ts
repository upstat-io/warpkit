import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	shouldValidateField,
	reindexArrayErrors,
	calculateDirtyState,
	mergeInitialValues,
	createErrorDebouncer,
	parseArrayErrorKey,
	hasAnyTrue,
	isEmptyRecord,
	removeKey,
	setKey
} from './form-logic';

describe('shouldValidateField', () => {
	describe('when field has existing error (revalidation)', () => {
		it('should validate on change when revalidateMode is change', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'change',
					mode: 'blur',
					revalidateMode: 'change',
					hasError: true,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(true);
		});

		it('should validate on blur when revalidateMode is blur', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'blur',
					mode: 'change',
					revalidateMode: 'blur',
					hasError: true,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(true);
		});

		it('should not validate on blur when revalidateMode is change', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'blur',
					mode: 'blur',
					revalidateMode: 'change',
					hasError: true,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(true); // revalidateMode 'change' validates on any event
		});

		it('should not validate on change when revalidateMode is blur', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'change',
					mode: 'change',
					revalidateMode: 'blur',
					hasError: true,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(false);
		});
	});

	describe('when form has been submitted', () => {
		it('should always validate after submission regardless of mode', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'change',
					mode: 'submit',
					revalidateMode: 'blur',
					hasError: false,
					isSubmitted: true,
					isTouched: false
				})
			).toBe(true);
		});

		it('should validate on blur after submission', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'blur',
					mode: 'submit',
					revalidateMode: 'blur',
					hasError: false,
					isSubmitted: true,
					isTouched: false
				})
			).toBe(true);
		});
	});

	describe('mode: submit', () => {
		it('should not validate on change before submission', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'change',
					mode: 'submit',
					revalidateMode: 'change',
					hasError: false,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(false);
		});

		it('should not validate on blur before submission', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'blur',
					mode: 'submit',
					revalidateMode: 'change',
					hasError: false,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(false);
		});
	});

	describe('mode: blur', () => {
		it('should validate on blur', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'blur',
					mode: 'blur',
					revalidateMode: 'change',
					hasError: false,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(true);
		});

		it('should not validate on change', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'change',
					mode: 'blur',
					revalidateMode: 'change',
					hasError: false,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(false);
		});
	});

	describe('mode: change', () => {
		it('should validate on change', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'change',
					mode: 'change',
					revalidateMode: 'blur',
					hasError: false,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(true);
		});

		it('should validate on blur', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'blur',
					mode: 'change',
					revalidateMode: 'blur',
					hasError: false,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(true);
		});
	});

	describe('mode: touched', () => {
		it('should validate on change when field is touched', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'change',
					mode: 'touched',
					revalidateMode: 'change',
					hasError: false,
					isSubmitted: false,
					isTouched: true
				})
			).toBe(true);
		});

		it('should not validate on change when field is not touched', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'change',
					mode: 'touched',
					revalidateMode: 'change',
					hasError: false,
					isSubmitted: false,
					isTouched: false
				})
			).toBe(false);
		});

		it('should not validate on blur even when touched', () => {
			expect(
				shouldValidateField({
					field: 'email',
					event: 'blur',
					mode: 'touched',
					revalidateMode: 'change',
					hasError: false,
					isSubmitted: false,
					isTouched: true
				})
			).toBe(false);
		});
	});
});

describe('reindexArrayErrors', () => {
	describe('removing items (delta = -1)', () => {
		it('should remove errors for the deleted index', () => {
			const errors = {
				'items.0.name': 'Error 0',
				'items.1.name': 'Error 1',
				'items.2.name': 'Error 2'
			};

			const result = reindexArrayErrors(errors, 'items', 1, -1);

			expect(result).toEqual({
				'items.0.name': 'Error 0',
				'items.1.name': 'Error 2'
			});
		});

		it('should keep errors before the deleted index unchanged', () => {
			const errors = {
				'items.0.name': 'Error 0',
				'items.3.name': 'Error 3'
			};

			const result = reindexArrayErrors(errors, 'items', 2, -1);

			expect(result['items.0.name']).toBe('Error 0');
			expect(result['items.2.name']).toBe('Error 3');
		});

		it('should handle removing the first item', () => {
			const errors = {
				'items.0.name': 'Error 0',
				'items.1.name': 'Error 1'
			};

			const result = reindexArrayErrors(errors, 'items', 0, -1);

			expect(result).toEqual({
				'items.0.name': 'Error 1'
			});
		});

		it('should handle removing the last item', () => {
			const errors = {
				'items.0.name': 'Error 0',
				'items.1.name': 'Error 1'
			};

			const result = reindexArrayErrors(errors, 'items', 1, -1);

			expect(result).toEqual({
				'items.0.name': 'Error 0'
			});
		});

		it('should preserve nested suffixes', () => {
			const errors = {
				'items.0.address.city': 'Error city 0',
				'items.1.address.city': 'Error city 1'
			};

			const result = reindexArrayErrors(errors, 'items', 0, -1);

			expect(result).toEqual({
				'items.0.address.city': 'Error city 1'
			});
		});
	});

	describe('inserting items (delta = +1)', () => {
		it('should shift errors at and after insert index', () => {
			const errors = {
				'items.0.name': 'Error 0',
				'items.1.name': 'Error 1'
			};

			const result = reindexArrayErrors(errors, 'items', 1, 1);

			expect(result).toEqual({
				'items.0.name': 'Error 0',
				'items.2.name': 'Error 1'
			});
		});

		it('should handle inserting at the beginning', () => {
			const errors = {
				'items.0.name': 'Error 0',
				'items.1.name': 'Error 1'
			};

			const result = reindexArrayErrors(errors, 'items', 0, 1);

			expect(result).toEqual({
				'items.1.name': 'Error 0',
				'items.2.name': 'Error 1'
			});
		});

		it('should handle inserting at the end (no shift needed)', () => {
			const errors = {
				'items.0.name': 'Error 0'
			};

			const result = reindexArrayErrors(errors, 'items', 1, 1);

			expect(result).toEqual({
				'items.0.name': 'Error 0'
			});
		});
	});

	describe('preserving unrelated errors', () => {
		it('should preserve errors for different fields', () => {
			const errors = {
				'items.0.name': 'Error 0',
				'other.field': 'Other error',
				name: 'Name error'
			};

			const result = reindexArrayErrors(errors, 'items', 0, -1);

			expect(result['other.field']).toBe('Other error');
			expect(result['name']).toBe('Name error');
		});

		it('should handle non-numeric array-like keys', () => {
			const errors = {
				'items.0.name': 'Error 0',
				'items.abc': 'Non-numeric'
			};

			const result = reindexArrayErrors(errors, 'items', 0, -1);

			expect(result['items.abc']).toBe('Non-numeric');
		});
	});

	describe('edge cases', () => {
		it('should handle empty errors object', () => {
			const result = reindexArrayErrors({}, 'items', 0, -1);
			expect(result).toEqual({});
		});

		it('should handle no matching errors', () => {
			const errors = { name: 'Error', email: 'Error' };
			const result = reindexArrayErrors(errors, 'items', 0, -1);
			expect(result).toEqual(errors);
		});
	});
});

describe('calculateDirtyState', () => {
	const mockGetPath = (obj: Record<string, unknown>, path: string) => obj[path];

	it('should return false for unchanged values', () => {
		const current = { name: 'John', email: 'john@example.com' };
		const initial = { name: 'John', email: 'john@example.com' };

		const result = calculateDirtyState(current, initial, ['name', 'email'], mockGetPath);

		expect(result).toEqual({ name: false, email: false });
	});

	it('should return true for changed values', () => {
		const current = { name: 'Jane', email: 'john@example.com' };
		const initial = { name: 'John', email: 'john@example.com' };

		const result = calculateDirtyState(current, initial, ['name', 'email'], mockGetPath);

		expect(result).toEqual({ name: true, email: false });
	});

	it('should handle null values correctly', () => {
		const current = { name: null };
		const initial = { name: null };

		const result = calculateDirtyState(current, initial, ['name'], mockGetPath);

		expect(result.name).toBe(false);
	});

	it('should treat null and undefined as different', () => {
		const current = { name: null };
		const initial = { name: undefined };

		const result = calculateDirtyState(current, initial, ['name'], mockGetPath);

		expect(result.name).toBe(true);
	});

	it('should use Object.is for comparison (handles NaN)', () => {
		const current = { value: NaN };
		const initial = { value: NaN };

		const result = calculateDirtyState(current, initial, ['value'], mockGetPath);

		expect(result.value).toBe(false); // Object.is(NaN, NaN) is true
	});

	it('should handle empty paths array', () => {
		const result = calculateDirtyState({ a: 1 }, { a: 2 }, [], mockGetPath);
		expect(result).toEqual({});
	});
});

describe('mergeInitialValues', () => {
	it('should merge schema defaults with initial values', () => {
		const schemaDefaults = { name: 'default', age: 0 };
		const initialValues = { name: 'John' };

		const result = mergeInitialValues(schemaDefaults, initialValues);

		expect(result).toEqual({ name: 'John', age: 0 });
	});

	it('should handle undefined schema defaults', () => {
		const initialValues = { name: 'John' };

		const result = mergeInitialValues(undefined, initialValues);

		expect(result).toEqual({ name: 'John' });
	});

	it('should handle undefined initial values', () => {
		const schemaDefaults = { name: 'default' };

		const result = mergeInitialValues(schemaDefaults, undefined);

		expect(result).toEqual({ name: 'default' });
	});

	it('should handle both undefined', () => {
		const result = mergeInitialValues(undefined, undefined);
		expect(result).toEqual({});
	});

	it('should create a deep clone', () => {
		const initialValues = { nested: { value: 1 } };

		const result = mergeInitialValues(undefined, initialValues);
		(result as { nested: { value: number } }).nested.value = 2;

		expect(initialValues.nested.value).toBe(1);
	});
});

describe('createErrorDebouncer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('with no delay (0ms)', () => {
		it('should set error immediately', () => {
			const debouncer = createErrorDebouncer(0);
			const setError = vi.fn();

			debouncer.set('email', 'Invalid email', setError);

			expect(setError).toHaveBeenCalledWith('email', 'Invalid email');
		});
	});

	describe('with delay', () => {
		it('should not set error immediately', () => {
			const debouncer = createErrorDebouncer(500);
			const setError = vi.fn();

			debouncer.set('email', 'Invalid email', setError);

			expect(setError).not.toHaveBeenCalled();
		});

		it('should set error after delay', () => {
			const debouncer = createErrorDebouncer(500);
			const setError = vi.fn();

			debouncer.set('email', 'Invalid email', setError);
			vi.advanceTimersByTime(500);

			expect(setError).toHaveBeenCalledWith('email', 'Invalid email');
		});

		it('should cancel previous timer when setting same field', () => {
			const debouncer = createErrorDebouncer(500);
			const setError = vi.fn();

			debouncer.set('email', 'First error', setError);
			vi.advanceTimersByTime(250);
			debouncer.set('email', 'Second error', setError);
			vi.advanceTimersByTime(500);

			expect(setError).toHaveBeenCalledTimes(1);
			expect(setError).toHaveBeenCalledWith('email', 'Second error');
		});

		it('should handle multiple fields independently', () => {
			const debouncer = createErrorDebouncer(500);
			const setError = vi.fn();

			debouncer.set('email', 'Email error', setError);
			debouncer.set('name', 'Name error', setError);
			vi.advanceTimersByTime(500);

			expect(setError).toHaveBeenCalledTimes(2);
		});
	});

	describe('clear', () => {
		it('should cancel pending timer for field', () => {
			const debouncer = createErrorDebouncer(500);
			const setError = vi.fn();

			debouncer.set('email', 'Invalid email', setError);
			debouncer.clear('email');
			vi.advanceTimersByTime(500);

			expect(setError).not.toHaveBeenCalled();
		});

		it('should not affect other fields', () => {
			const debouncer = createErrorDebouncer(500);
			const setError = vi.fn();

			debouncer.set('email', 'Email error', setError);
			debouncer.set('name', 'Name error', setError);
			debouncer.clear('email');
			vi.advanceTimersByTime(500);

			expect(setError).toHaveBeenCalledTimes(1);
			expect(setError).toHaveBeenCalledWith('name', 'Name error');
		});
	});

	describe('clearAll', () => {
		it('should cancel all pending timers', () => {
			const debouncer = createErrorDebouncer(500);
			const setError = vi.fn();

			debouncer.set('email', 'Email error', setError);
			debouncer.set('name', 'Name error', setError);
			debouncer.clearAll();
			vi.advanceTimersByTime(500);

			expect(setError).not.toHaveBeenCalled();
		});
	});

	describe('hasPending', () => {
		it('should return true when timer is pending', () => {
			const debouncer = createErrorDebouncer(500);
			const setError = vi.fn();

			debouncer.set('email', 'Error', setError);

			expect(debouncer.hasPending('email')).toBe(true);
		});

		it('should return false after timer fires', () => {
			const debouncer = createErrorDebouncer(500);
			const setError = vi.fn();

			debouncer.set('email', 'Error', setError);
			vi.advanceTimersByTime(500);

			expect(debouncer.hasPending('email')).toBe(false);
		});

		it('should return false for cleared field', () => {
			const debouncer = createErrorDebouncer(500);
			const setError = vi.fn();

			debouncer.set('email', 'Error', setError);
			debouncer.clear('email');

			expect(debouncer.hasPending('email')).toBe(false);
		});

		it('should return false for non-existent field', () => {
			const debouncer = createErrorDebouncer(500);
			expect(debouncer.hasPending('email')).toBe(false);
		});
	});
});

describe('parseArrayErrorKey', () => {
	it('should parse valid array error key', () => {
		const result = parseArrayErrorKey('items.0.name', 'items.');
		expect(result).toEqual({ index: 0, suffix: '.name' });
	});

	it('should parse key with nested suffix', () => {
		const result = parseArrayErrorKey('items.5.address.city', 'items.');
		expect(result).toEqual({ index: 5, suffix: '.address.city' });
	});

	it('should parse key with no suffix', () => {
		const result = parseArrayErrorKey('items.3', 'items.');
		expect(result).toEqual({ index: 3, suffix: '' });
	});

	it('should return null for non-matching prefix', () => {
		const result = parseArrayErrorKey('other.0.name', 'items.');
		expect(result).toBeNull();
	});

	it('should return null for non-numeric index', () => {
		const result = parseArrayErrorKey('items.abc.name', 'items.');
		expect(result).toBeNull();
	});

	it('should handle multi-digit indices', () => {
		const result = parseArrayErrorKey('items.123.name', 'items.');
		expect(result).toEqual({ index: 123, suffix: '.name' });
	});
});

describe('hasAnyTrue', () => {
	it('should return true when any value is true', () => {
		expect(hasAnyTrue({ a: false, b: true, c: false })).toBe(true);
	});

	it('should return false when all values are false', () => {
		expect(hasAnyTrue({ a: false, b: false })).toBe(false);
	});

	it('should return false for empty object', () => {
		expect(hasAnyTrue({})).toBe(false);
	});

	it('should return true when all values are true', () => {
		expect(hasAnyTrue({ a: true, b: true })).toBe(true);
	});
});

describe('isEmptyRecord', () => {
	it('should return true for empty object', () => {
		expect(isEmptyRecord({})).toBe(true);
	});

	it('should return false for non-empty object', () => {
		expect(isEmptyRecord({ a: 1 })).toBe(false);
	});

	it('should return false for object with undefined value', () => {
		expect(isEmptyRecord({ a: undefined })).toBe(false);
	});
});

describe('removeKey', () => {
	it('should remove existing key', () => {
		const result = removeKey({ a: 1, b: 2 }, 'a');
		expect(result).toEqual({ b: 2 });
	});

	it('should return same shape for non-existent key', () => {
		const result = removeKey({ a: 1 }, 'b');
		expect(result).toEqual({ a: 1 });
	});

	it('should not mutate original', () => {
		const original = { a: 1, b: 2 };
		removeKey(original, 'a');
		expect(original).toEqual({ a: 1, b: 2 });
	});

	it('should handle empty object', () => {
		const result = removeKey({}, 'a');
		expect(result).toEqual({});
	});
});

describe('setKey', () => {
	it('should add new key', () => {
		const result = setKey({ a: 1 }, 'b', 2);
		expect(result).toEqual({ a: 1, b: 2 });
	});

	it('should update existing key', () => {
		const result = setKey({ a: 1 }, 'a', 2);
		expect(result).toEqual({ a: 2 });
	});

	it('should not mutate original', () => {
		const original = { a: 1 };
		setKey(original, 'b', 2);
		expect(original).toEqual({ a: 1 });
	});

	it('should handle empty object', () => {
		const result = setKey({}, 'a', 1);
		expect(result).toEqual({ a: 1 });
	});
});
