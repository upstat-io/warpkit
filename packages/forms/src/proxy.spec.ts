import { describe, it, expect, vi } from 'vitest';
import { createDeepProxy } from './proxy';

describe('createDeepProxy', () => {
	describe('basic property sets', () => {
		it('intercepts top-level property sets', () => {
			const onSet = vi.fn();
			const target = { name: 'John' };
			const proxy = createDeepProxy(target, { onSet });

			proxy.name = 'Jane';

			expect(onSet).toHaveBeenCalledWith('name', 'Jane');
			expect(target.name).toBe('Jane');
		});

		it('intercepts nested property sets', () => {
			const onSet = vi.fn();
			const target = { user: { name: 'John' } };
			const proxy = createDeepProxy(target, { onSet });

			proxy.user.name = 'Jane';

			expect(onSet).toHaveBeenCalledWith('user.name', 'Jane');
			expect(target.user.name).toBe('Jane');
		});

		it('intercepts deep nested property sets', () => {
			const onSet = vi.fn();
			const target = { a: { b: { c: { d: { e: 'deep' } } } } };
			const proxy = createDeepProxy(target, { onSet });

			proxy.a.b.c.d.e = 'updated';

			expect(onSet).toHaveBeenCalledWith('a.b.c.d.e', 'updated');
			expect(target.a.b.c.d.e).toBe('updated');
		});

		it('builds correct path for 5+ level nesting', () => {
			const onSet = vi.fn();
			const target = {
				level1: {
					level2: {
						level3: {
							level4: { level5: { level6: 'value' } }
						}
					}
				}
			};
			const proxy = createDeepProxy(target, { onSet });

			proxy.level1.level2.level3.level4.level5.level6 = 'new';

			expect(onSet).toHaveBeenCalledWith('level1.level2.level3.level4.level5.level6', 'new');
		});
	});

	describe('array handling', () => {
		it('intercepts array index sets', () => {
			const onSet = vi.fn();
			const target = { items: ['a', 'b', 'c'] };
			const proxy = createDeepProxy(target, { onSet });

			proxy.items[0] = 'new';

			expect(onSet).toHaveBeenCalledWith('items.0', 'new');
			expect(target.items[0]).toBe('new');
		});

		it('intercepts nested array index sets', () => {
			const onSet = vi.fn();
			const target = { data: { items: [{ name: 'first' }] } };
			const proxy = createDeepProxy(target, { onSet });

			proxy.data.items[0].name = 'updated';

			expect(onSet).toHaveBeenCalledWith('data.items.0.name', 'updated');
		});

		it('intercepts array push via index', () => {
			const onSet = vi.fn();
			const target = { items: ['a'] };
			const proxy = createDeepProxy(target, { onSet });

			proxy.items[1] = 'b';

			expect(onSet).toHaveBeenCalledWith('items.1', 'b');
			expect(target.items).toEqual(['a', 'b']);
		});
	});

	describe('symbol handling', () => {
		it('passes through symbol property gets', () => {
			const sym = Symbol('test');
			const onSet = vi.fn();
			const onGet = vi.fn();
			const target = { [sym]: 'symbol value', name: 'test' } as Record<string | symbol, string>;
			const proxy = createDeepProxy(target, { onSet, onGet });

			const value = proxy[sym];

			expect(value).toBe('symbol value');
			expect(onGet).not.toHaveBeenCalled(); // symbols don't trigger onGet
		});

		it('passes through symbol property sets', () => {
			const sym = Symbol('test');
			const onSet = vi.fn();
			const target = {} as Record<symbol, string>;
			const proxy = createDeepProxy(target, { onSet });

			proxy[sym] = 'new value';

			expect(target[sym]).toBe('new value');
			expect(onSet).not.toHaveBeenCalled(); // symbols don't trigger onSet
		});

		it('handles Symbol.iterator', () => {
			const onSet = vi.fn();
			const target = { items: [1, 2, 3] };
			const proxy = createDeepProxy(target, { onSet });

			const iterator = proxy.items[Symbol.iterator];

			expect(iterator).toBeDefined();
			expect(typeof iterator).toBe('function');
		});
	});

	describe('null and undefined handling', () => {
		it('returns null as-is', () => {
			const onSet = vi.fn();
			const result = createDeepProxy(null as unknown as object, { onSet });

			expect(result).toBeNull();
		});

		it('returns undefined as-is', () => {
			const onSet = vi.fn();
			const result = createDeepProxy(undefined as unknown as object, { onSet });

			expect(result).toBeUndefined();
		});

		it('handles null values in nested objects', () => {
			const onSet = vi.fn();
			const target = { user: null as { name: string } | null };
			const proxy = createDeepProxy(target, { onSet });

			// Accessing null property should not throw
			expect(proxy.user).toBeNull();
		});

		it('handles undefined values in nested objects', () => {
			const onGet = vi.fn();
			const target: { user?: { name: string } } = {};
			const proxy = createDeepProxy(target, { onSet: vi.fn(), onGet });

			expect(proxy.user).toBeUndefined();
		});
	});

	describe('primitive handling', () => {
		it('returns primitive values without proxying', () => {
			const onSet = vi.fn();
			const result = createDeepProxy('string' as unknown as object, { onSet });

			expect(result).toBe('string');
		});

		it('returns number without proxying', () => {
			const onSet = vi.fn();
			const result = createDeepProxy(42 as unknown as object, { onSet });

			expect(result).toBe(42);
		});

		it('returns boolean without proxying', () => {
			const onSet = vi.fn();
			const result = createDeepProxy(true as unknown as object, { onSet });

			expect(result).toBe(true);
		});
	});

	describe('onGet callback', () => {
		it('calls onGet when accessing properties', () => {
			const onSet = vi.fn();
			const onGet = vi.fn();
			const target = { name: 'John', age: 30 };
			const proxy = createDeepProxy(target, { onSet, onGet });

			const _name = proxy.name;

			expect(onGet).toHaveBeenCalledWith('name', 'John');
		});

		it('calls onGet for nested property access', () => {
			const onSet = vi.fn();
			const onGet = vi.fn();
			const target = { user: { name: 'John' } };
			const proxy = createDeepProxy(target, { onSet, onGet });

			const _name = proxy.user.name;

			expect(onGet).toHaveBeenCalledWith('user', { name: 'John' });
			expect(onGet).toHaveBeenCalledWith('user.name', 'John');
		});

		it('works without onGet callback', () => {
			const onSet = vi.fn();
			const target = { name: 'John' };
			const proxy = createDeepProxy(target, { onSet });

			// Should not throw
			expect(proxy.name).toBe('John');
		});
	});

	describe('object replacement', () => {
		it('calls onSet when replacing entire nested object', () => {
			const onSet = vi.fn();
			const target = { user: { name: 'John', age: 30 } };
			const proxy = createDeepProxy(target, { onSet });

			proxy.user = { name: 'Jane', age: 25 };

			expect(onSet).toHaveBeenCalledWith('user', { name: 'Jane', age: 25 });
		});

		it('new nested object is also proxied', () => {
			const onSet = vi.fn();
			const target = { user: { name: 'John' } };
			const proxy = createDeepProxy(target, { onSet });

			proxy.user = { name: 'Jane' };
			onSet.mockClear();

			proxy.user.name = 'Updated';

			expect(onSet).toHaveBeenCalledWith('user.name', 'Updated');
		});
	});

	describe('date handling', () => {
		it('proxies Date objects', () => {
			const onSet = vi.fn();
			const target = { created: new Date('2024-01-01') };
			const proxy = createDeepProxy(target, { onSet });

			// Date is an object, so it gets proxied
			const date = proxy.created;
			expect(date).toBeInstanceOf(Date);
		});

		it('allows replacing Date objects', () => {
			const onSet = vi.fn();
			const target = { created: new Date('2024-01-01') };
			const proxy = createDeepProxy(target, { onSet });

			proxy.created = new Date('2024-12-31');

			expect(onSet).toHaveBeenCalledWith('created', expect.any(Date));
		});
	});

	describe('complex scenarios', () => {
		it('handles mixed object and array nesting', () => {
			const onSet = vi.fn();
			const target = {
				users: [
					{ name: 'Alice', addresses: [{ city: 'NYC' }] },
					{ name: 'Bob', addresses: [{ city: 'LA' }] }
				]
			};
			const proxy = createDeepProxy(target, { onSet });

			proxy.users[0].addresses[0].city = 'Boston';

			expect(onSet).toHaveBeenCalledWith('users.0.addresses.0.city', 'Boston');
		});

		it('handles multiple consecutive sets', () => {
			const onSet = vi.fn();
			const target = { a: 1, b: 2, c: 3 };
			const proxy = createDeepProxy(target, { onSet });

			proxy.a = 10;
			proxy.b = 20;
			proxy.c = 30;

			expect(onSet).toHaveBeenCalledTimes(3);
			expect(onSet).toHaveBeenNthCalledWith(1, 'a', 10);
			expect(onSet).toHaveBeenNthCalledWith(2, 'b', 20);
			expect(onSet).toHaveBeenNthCalledWith(3, 'c', 30);
		});

		it('allows setting new properties', () => {
			const onSet = vi.fn();
			const target: Record<string, unknown> = { existing: 'value' };
			const proxy = createDeepProxy(target, { onSet });

			proxy.newProp = 'new value';

			expect(onSet).toHaveBeenCalledWith('newProp', 'new value');
			expect(target.newProp).toBe('new value');
		});
	});
});
