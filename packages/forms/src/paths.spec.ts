/**
 * Path utilities unit tests
 */
import { describe, it, expect } from 'vitest';
import { getPath, setPath, pathToString, getAllPaths } from './paths';

describe('getPath', () => {
	it('should get nested value with dot notation', () => {
		const obj = { user: { name: 'John' } };
		expect(getPath(obj, 'user.name')).toBe('John');
	});

	it('should get deeply nested value', () => {
		const obj = { a: { b: { c: { d: { e: 'deep' } } } } };
		expect(getPath(obj, 'a.b.c.d.e')).toBe('deep');
	});

	it('should return undefined for non-existent path', () => {
		const obj = { a: 1 };
		expect(getPath(obj, 'b')).toBeUndefined();
	});

	it('should return undefined for non-existent nested path', () => {
		const obj = { a: { b: 1 } };
		expect(getPath(obj, 'a.c.d')).toBeUndefined();
	});

	it('should handle array indices', () => {
		const obj = { items: [1, 2, 3] };
		expect(getPath(obj, 'items.0')).toBe(1);
		expect(getPath(obj, 'items.1')).toBe(2);
		expect(getPath(obj, 'items.2')).toBe(3);
	});

	it('should handle nested arrays', () => {
		const obj = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
		expect(getPath(obj, 'users.0.name')).toBe('Alice');
		expect(getPath(obj, 'users.1.name')).toBe('Bob');
	});

	it('should return object itself for empty path', () => {
		const obj = { a: 1 };
		expect(getPath(obj, '')).toBe(obj);
	});

	it('should handle null in path', () => {
		const obj = { a: null };
		expect(getPath(obj, 'a.b')).toBeUndefined();
	});

	it('should handle undefined in path', () => {
		const obj = { a: undefined };
		expect(getPath(obj, 'a.b')).toBeUndefined();
	});

	it('should return null value correctly', () => {
		const obj = { a: null };
		expect(getPath(obj, 'a')).toBeNull();
	});

	it('should return undefined value correctly', () => {
		const obj = { a: undefined };
		expect(getPath(obj, 'a')).toBeUndefined();
	});

	it('should handle numeric string keys', () => {
		const obj = { '123': 'numeric key' };
		expect(getPath(obj, '123')).toBe('numeric key');
	});
});

describe('setPath', () => {
	it('should set nested value and return new object', () => {
		const obj = { user: { name: 'John' } };
		const result = setPath(obj, 'user.name', 'Jane');

		expect(result.user.name).toBe('Jane');
		expect(obj.user.name).toBe('John'); // Original unchanged
	});

	it('should set deeply nested value', () => {
		const obj = { a: { b: { c: 1 } } };
		const result = setPath(obj, 'a.b.c', 2);

		expect(result.a.b.c).toBe(2);
		expect(obj.a.b.c).toBe(1);
	});

	it('should create intermediate objects for new path', () => {
		const obj = {};
		const result = setPath(obj, 'a.b.c', 1);

		expect(result).toEqual({ a: { b: { c: 1 } } });
	});

	it('should create intermediate arrays when index is numeric', () => {
		const obj = {};
		const result = setPath(obj, 'items.0', 'first') as { items: string[] };

		expect(Array.isArray(result.items)).toBe(true);
		expect(result.items[0]).toBe('first');
	});

	it('should handle array indices', () => {
		const obj = { items: [1, 2, 3] };
		const result = setPath(obj, 'items.1', 5);

		expect(result.items).toEqual([1, 5, 3]);
		expect(obj.items).toEqual([1, 2, 3]);
	});

	it('should set nested object in array', () => {
		const obj = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
		const result = setPath(obj, 'users.0.name', 'Alicia');

		expect(result.users[0].name).toBe('Alicia');
		expect(obj.users[0].name).toBe('Alice');
	});

	it('should replace value for empty path', () => {
		const obj = { a: 1 };
		const result = setPath(obj, '', { b: 2 });

		expect(result).toEqual({ b: 2 });
	});

	it('should handle null intermediate value by replacing', () => {
		const obj = { a: null };
		const result = setPath(obj, 'a.b', 1);

		expect(result).toEqual({ a: { b: 1 } });
	});

	it('should handle undefined intermediate value by replacing', () => {
		const obj = { a: undefined };
		const result = setPath(obj, 'a.b', 1);

		expect(result).toEqual({ a: { b: 1 } });
	});

	it('should handle very deep nesting', () => {
		const obj = {};
		const result = setPath(obj, 'a.b.c.d.e.f.g.h.i.j', 'deep');

		expect(getPath(result, 'a.b.c.d.e.f.g.h.i.j')).toBe('deep');
	});

	it('should be immutable - original object not modified', () => {
		const original = { a: { b: { c: 1 } } };
		const originalJson = JSON.stringify(original);

		setPath(original, 'a.b.c', 999);

		expect(JSON.stringify(original)).toBe(originalJson);
	});
});

describe('pathToString', () => {
	it('should convert simple path array', () => {
		expect(pathToString(['user', 'name'])).toBe('user.name');
	});

	it('should convert path with array indices', () => {
		expect(pathToString(['items', 0, 'id'])).toBe('items.0.id');
	});

	it('should return empty string for empty array', () => {
		expect(pathToString([])).toBe('');
	});

	it('should return empty string for undefined', () => {
		expect(pathToString(undefined)).toBe('');
	});

	it('should handle single element', () => {
		expect(pathToString(['name'])).toBe('name');
	});

	it('should handle mixed string and number elements', () => {
		expect(pathToString(['users', 0, 'addresses', 1, 'city'])).toBe('users.0.addresses.1.city');
	});

	it('should convert numeric strings correctly', () => {
		expect(pathToString(['0', '1', '2'])).toBe('0.1.2');
	});

	it('should handle deeply nested paths', () => {
		expect(pathToString(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('a.b.c.d.e.f');
	});
});

describe('getAllPaths', () => {
	it('should get paths from simple object', () => {
		const obj = { name: 'John', age: 30 };
		expect(getAllPaths(obj).sort()).toEqual(['age', 'name']);
	});

	it('should get paths from nested object', () => {
		const obj = { user: { name: 'John', age: 30 } };
		expect(getAllPaths(obj).sort()).toEqual(['user.age', 'user.name']);
	});

	it('should get paths from deeply nested object', () => {
		const obj = { a: { b: { c: 1 } } };
		expect(getAllPaths(obj)).toEqual(['a.b.c']);
	});

	it('should get paths from array', () => {
		const obj = { items: [1, 2, 3] };
		expect(getAllPaths(obj).sort()).toEqual(['items.0', 'items.1', 'items.2']);
	});

	it('should get paths from array of objects', () => {
		const obj = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
		expect(getAllPaths(obj).sort()).toEqual(['users.0.name', 'users.1.name']);
	});

	it('should return empty array for empty object', () => {
		expect(getAllPaths({})).toEqual([]);
	});

	it('should return empty array for null', () => {
		expect(getAllPaths(null)).toEqual([]);
	});

	it('should return empty array for undefined', () => {
		expect(getAllPaths(undefined)).toEqual([]);
	});

	it('should return empty array for primitive', () => {
		expect(getAllPaths('string')).toEqual([]);
		expect(getAllPaths(123)).toEqual([]);
		expect(getAllPaths(true)).toEqual([]);
	});

	it('should handle mixed nesting', () => {
		const obj = {
			name: 'Form',
			fields: [
				{ label: 'Email', type: 'text' },
				{ label: 'Password', type: 'password' }
			],
			meta: { version: 1 }
		};
		const paths = getAllPaths(obj).sort();
		expect(paths).toEqual([
			'fields.0.label',
			'fields.0.type',
			'fields.1.label',
			'fields.1.type',
			'meta.version',
			'name'
		]);
	});

	it('should handle empty arrays as leaves', () => {
		const obj = { items: [] };
		expect(getAllPaths(obj)).toEqual(['items']);
	});

	it('should handle empty nested objects as leaves', () => {
		const obj = { meta: {} };
		expect(getAllPaths(obj)).toEqual(['meta']);
	});

	it('should handle null values in object', () => {
		const obj = { a: null, b: 1 };
		expect(getAllPaths(obj).sort()).toEqual(['a', 'b']);
	});

	it('should handle undefined values in object', () => {
		const obj = { a: undefined, b: 1 };
		expect(getAllPaths(obj).sort()).toEqual(['a', 'b']);
	});

	it('should handle nested arrays', () => {
		const obj = {
			matrix: [
				[1, 2],
				[3, 4]
			]
		};
		const paths = getAllPaths(obj).sort();
		expect(paths).toEqual(['matrix.0.0', 'matrix.0.1', 'matrix.1.0', 'matrix.1.1']);
	});
});
