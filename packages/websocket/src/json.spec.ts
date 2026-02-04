/**
 * Json utility unit tests
 *
 * Tests safe JSON parsing with prototype pollution protection.
 */
import { describe, it, expect } from 'vitest';
import { Json } from './json';

describe('Json', () => {
	describe('parse()', () => {
		it('should parse valid JSON strings', () => {
			const result = Json.parse<{ name: string }>('{"name": "test"}');
			expect(result.name).toBe('test');
		});

		it('should parse arrays', () => {
			const result = Json.parse<number[]>('[1, 2, 3]');
			expect(result).toEqual([1, 2, 3]);
		});

		it('should parse primitives', () => {
			expect(Json.parse<string>('"hello"')).toBe('hello');
			expect(Json.parse<number>('42')).toBe(42);
			expect(Json.parse<boolean>('true')).toBe(true);
			expect(Json.parse<null>('null')).toBe(null);
		});

		it('should throw on invalid JSON', () => {
			expect(() => Json.parse('invalid')).toThrow();
			expect(() => Json.parse('{bad: json}')).toThrow();
		});

		it('should strip __proto__ key from objects', () => {
			const json = '{"safe": "value", "__proto__": {"admin": true}}';
			const result = Json.parse<{ safe: string }>(json);

			expect(result.safe).toBe('value');
			expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
			expect(Object.keys(result)).toEqual(['safe']);
		});

		it('should strip constructor key from objects', () => {
			const json = '{"safe": "value", "constructor": {"polluted": true}}';
			const result = Json.parse<{ safe: string }>(json);

			expect(result.safe).toBe('value');
			expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(false);
			expect(Object.keys(result)).toEqual(['safe']);
		});

		it('should strip prototype key from objects', () => {
			const json = '{"safe": "value", "prototype": {"polluted": true}}';
			const result = Json.parse<{ safe: string }>(json);

			expect(result.safe).toBe('value');
			expect(Object.prototype.hasOwnProperty.call(result, 'prototype')).toBe(false);
			expect(Object.keys(result)).toEqual(['safe']);
		});

		it('should strip dangerous keys from nested objects', () => {
			const json = JSON.stringify({
				level1: {
					safe: 'value',
					__proto__: { admin: true },
					nested: {
						safe: 'nested-value',
						constructor: { polluted: true }
					}
				}
			});

			const result = Json.parse<{ level1: { safe: string; nested: { safe: string } } }>(json);

			expect(result.level1.safe).toBe('value');
			expect(result.level1.nested.safe).toBe('nested-value');
			expect(Object.keys(result.level1)).toEqual(['safe', 'nested']);
			expect(Object.keys(result.level1.nested)).toEqual(['safe']);
		});

		it('should strip dangerous keys from arrays of objects', () => {
			const json = JSON.stringify([
				{ safe: 'a', __proto__: { admin: true } },
				{ safe: 'b', constructor: { polluted: true } }
			]);

			const result = Json.parse<Array<{ safe: string }>>(json);

			expect(result).toHaveLength(2);
			expect(result[0].safe).toBe('a');
			expect(result[1].safe).toBe('b');
			expect(Object.keys(result[0])).toEqual(['safe']);
			expect(Object.keys(result[1])).toEqual(['safe']);
		});

		it('should not pollute Object prototype', () => {
			const json = '{"__proto__": {"polluted": true}}';
			Json.parse(json);

			// Verify prototype was not polluted
			const testObj: Record<string, unknown> = {};
			expect(testObj.polluted).toBeUndefined();
		});

		it('should preserve Date instances from reviver', () => {
			const json = '{"date": "2024-01-01T00:00:00.000Z"}';
			const result = Json.parse(json, (key, value) => {
				if (key === 'date') return new Date(value as string);
				return value;
			});

			expect((result as { date: Date }).date).toBeInstanceOf(Date);
		});

		it('should handle deeply nested objects', () => {
			const json = JSON.stringify({
				a: {
					b: {
						c: {
							d: {
								safe: 'deep',
								__proto__: { bad: true }
							}
						}
					}
				}
			});

			const result = Json.parse<{ a: { b: { c: { d: { safe: string } } } } }>(json);

			expect(result.a.b.c.d.safe).toBe('deep');
			expect(Object.keys(result.a.b.c.d)).toEqual(['safe']);
		});

		it('should handle empty objects', () => {
			const result = Json.parse<Record<string, never>>('{}');
			expect(result).toEqual({});
		});

		it('should handle empty arrays', () => {
			const result = Json.parse<never[]>('[]');
			expect(result).toEqual([]);
		});

		it('should handle mixed arrays', () => {
			const json = '[1, "string", {"safe": "obj", "__proto__": {}}, null, [2, 3]]';
			const result = Json.parse<unknown[]>(json);

			expect(result).toHaveLength(5);
			expect(result[0]).toBe(1);
			expect(result[1]).toBe('string');
			expect((result[2] as { safe: string }).safe).toBe('obj');
			expect(Object.keys(result[2] as object)).toEqual(['safe']);
			expect(result[3]).toBe(null);
			expect(result[4]).toEqual([2, 3]);
		});

		it('should preserve RegExp instances', () => {
			const json = '{"pattern": "test"}';
			const result = Json.parse(json, (key, value) => {
				if (key === 'pattern') return new RegExp(value as string);
				return value;
			});

			expect((result as { pattern: RegExp }).pattern).toBeInstanceOf(RegExp);
		});
	});
});
