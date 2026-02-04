/**
 * MemoryCache Unit Tests
 *
 * Tests LRU eviction behavior, recency updates, and cache operations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCache } from './MemoryCache.js';
import { createEntry } from './test-utils.js';

describe('MemoryCache', () => {
	let cache: MemoryCache;

	beforeEach(() => {
		cache = new MemoryCache({ maxEntries: 3 });
	});

	describe('constructor', () => {
		it('should use default maxEntries of 100 when no options provided', () => {
			const defaultCache = new MemoryCache();
			// Add 100 entries - all should fit
			for (let i = 0; i < 100; i++) {
				defaultCache.set(`key${i}`, createEntry(i));
			}
			expect(defaultCache.size()).toBe(100);

			// 101st entry should evict the first
			defaultCache.set('key100', createEntry(100));
			expect(defaultCache.size()).toBe(100);
			expect(defaultCache.get('key0')).toBeUndefined();
		});

		it('should respect custom maxEntries option', () => {
			const smallCache = new MemoryCache({ maxEntries: 2 });
			smallCache.set('a', createEntry('a'));
			smallCache.set('b', createEntry('b'));
			smallCache.set('c', createEntry('c'));

			expect(smallCache.size()).toBe(2);
			expect(smallCache.get('a')).toBeUndefined();
		});
	});

	describe('get', () => {
		it('should return undefined for nonexistent key', () => {
			expect(cache.get('nonexistent')).toBeUndefined();
		});

		it('should return cached entry for existing key', () => {
			const entry = createEntry({ name: 'test' });
			cache.set('key1', entry);

			const result = cache.get<{ name: string }>('key1');
			expect(result).toBeDefined();
			expect(result?.data.name).toBe('test');
		});

		it('should preserve entry metadata', () => {
			const entry = createEntry('data', 'etag-123');
			entry.staleTime = 5000;
			cache.set('key1', entry);

			const result = cache.get<string>('key1');
			expect(result?.etag).toBe('etag-123');
			expect(result?.staleTime).toBe(5000);
		});

		it('should update recency when getting an entry', () => {
			// Fill cache
			cache.set('a', createEntry('a'));
			cache.set('b', createEntry('b'));
			cache.set('c', createEntry('c'));

			// Access 'a' to make it most recent
			cache.get('a');

			// Add new entry - should evict 'b' (now oldest) instead of 'a'
			cache.set('d', createEntry('d'));

			expect(cache.get('a')).toBeDefined();
			expect(cache.get('b')).toBeUndefined();
			expect(cache.get('c')).toBeDefined();
			expect(cache.get('d')).toBeDefined();
		});
	});

	describe('set', () => {
		it('should store an entry', () => {
			cache.set('key1', createEntry('value1'));
			expect(cache.get<string>('key1')?.data).toBe('value1');
		});

		it('should overwrite existing entry', () => {
			cache.set('key1', createEntry('value1'));
			cache.set('key1', createEntry('value2'));

			expect(cache.get<string>('key1')?.data).toBe('value2');
			expect(cache.size()).toBe(1);
		});

		it('should evict oldest entry when at capacity', () => {
			cache.set('a', createEntry('a'));
			cache.set('b', createEntry('b'));
			cache.set('c', createEntry('c'));
			// Cache is now full

			cache.set('d', createEntry('d'));
			// 'a' should be evicted as oldest

			expect(cache.get('a')).toBeUndefined();
			expect(cache.get('b')).toBeDefined();
			expect(cache.get('c')).toBeDefined();
			expect(cache.get('d')).toBeDefined();
			expect(cache.size()).toBe(3);
		});

		it('should move updated entry to most recent position', () => {
			cache.set('a', createEntry('a'));
			cache.set('b', createEntry('b'));
			cache.set('c', createEntry('c'));

			// Update 'a' to make it most recent
			cache.set('a', createEntry('a-updated'));

			// Add new entry - should evict 'b' (now oldest)
			cache.set('d', createEntry('d'));

			expect(cache.get<string>('a')?.data).toBe('a-updated');
			expect(cache.get('b')).toBeUndefined();
		});
	});

	describe('set with maxEntries = 0', () => {
		it('should effectively disable caching when maxEntries is 0', () => {
			const disabledCache = new MemoryCache({ maxEntries: 0 });

			disabledCache.set('key1', createEntry('value1'));
			expect(disabledCache.get('key1')).toBeUndefined();
			expect(disabledCache.size()).toBe(0);
		});
	});

	describe('delete', () => {
		it('should remove an existing entry', () => {
			cache.set('key1', createEntry('value1'));
			cache.delete('key1');

			expect(cache.get('key1')).toBeUndefined();
			expect(cache.size()).toBe(0);
		});

		it('should not throw when deleting nonexistent key', () => {
			expect(() => cache.delete('nonexistent')).not.toThrow();
		});
	});

	describe('deleteByPrefix', () => {
		it('should delete all entries matching prefix', () => {
			cache.set('monitors:1', createEntry('monitor1'));
			cache.set('monitors:2', createEntry('monitor2'));
			cache.set('alerts:1', createEntry('alert1'));

			cache.deleteByPrefix('monitors');

			expect(cache.get('monitors:1')).toBeUndefined();
			expect(cache.get('monitors:2')).toBeUndefined();
			expect(cache.get('alerts:1')).toBeDefined();
			expect(cache.size()).toBe(1);
		});

		it('should not throw when prefix matches nothing', () => {
			cache.set('key1', createEntry('value1'));

			expect(() => cache.deleteByPrefix('xyz')).not.toThrow();
			expect(cache.size()).toBe(1);
		});

		it('should handle empty prefix (deletes all)', () => {
			cache.set('a', createEntry('a'));
			cache.set('b', createEntry('b'));

			cache.deleteByPrefix('');

			expect(cache.size()).toBe(0);
		});
	});

	describe('clear', () => {
		it('should remove all entries', () => {
			cache.set('a', createEntry('a'));
			cache.set('b', createEntry('b'));
			cache.set('c', createEntry('c'));

			cache.clear();

			expect(cache.size()).toBe(0);
			expect(cache.get('a')).toBeUndefined();
			expect(cache.get('b')).toBeUndefined();
			expect(cache.get('c')).toBeUndefined();
		});

		it('should not throw when clearing empty cache', () => {
			expect(() => cache.clear()).not.toThrow();
		});
	});

	describe('size', () => {
		it('should return 0 for empty cache', () => {
			expect(cache.size()).toBe(0);
		});

		it('should return correct count', () => {
			cache.set('a', createEntry('a'));
			expect(cache.size()).toBe(1);

			cache.set('b', createEntry('b'));
			expect(cache.size()).toBe(2);

			cache.delete('a');
			expect(cache.size()).toBe(1);
		});
	});

	describe('LRU eviction order', () => {
		it('should maintain correct eviction order across multiple operations', () => {
			// Initial: a, b, c (a is oldest)
			cache.set('a', createEntry('a'));
			cache.set('b', createEntry('b'));
			cache.set('c', createEntry('c'));

			// Access a -> order: b, c, a
			cache.get('a');

			// Access b -> order: c, a, b
			cache.get('b');

			// Add d -> evicts c (oldest), order: a, b, d
			cache.set('d', createEntry('d'));

			expect(cache.get('c')).toBeUndefined();
			expect(cache.get('a')).toBeDefined();
			expect(cache.get('b')).toBeDefined();
			expect(cache.get('d')).toBeDefined();
		});
	});
});
