/**
 * ETagCacheProvider Integration Tests
 *
 * Tests two-tier cache coordination, promotion, and write-through behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ETagCacheProvider } from './ETagCacheProvider.js';
import { createEntry, createMockStorage } from './test-utils.js';

const DEFAULT_STALE_TIME_MS = 30000; // 30 seconds

describe('ETagCacheProvider', () => {
	let mockStorage: ReturnType<typeof createMockStorage>;
	let cache: ETagCacheProvider;

	beforeEach(() => {
		mockStorage = createMockStorage();
		cache = new ETagCacheProvider({
			memory: { maxEntries: 10 },
			storage: { storage: mockStorage, prefix: 'test:' }
		});
	});

	describe('constructor', () => {
		it('should create with default options', () => {
			const defaultCache = new ETagCacheProvider();
			// Should not throw and should be functional (memory-only in test env)
			expect(defaultCache).toBeInstanceOf(ETagCacheProvider);
		});

		it('should accept custom memory and storage options', async () => {
			const customCache = new ETagCacheProvider({
				memory: { maxEntries: 5 },
				storage: { prefix: 'custom:', storage: mockStorage }
			});

			await customCache.set('key', createEntry('value'));
			expect(mockStorage.getItem('custom:key')).not.toBeNull();
		});
	});

	describe('get', () => {
		it('should return undefined for nonexistent key', async () => {
			const result = await cache.get('nonexistent');
			expect(result).toBeUndefined();
		});

		it('should return entry from memory', async () => {
			await cache.set('key1', createEntry({ name: 'test' }));

			const result = await cache.get<{ name: string }>('key1');
			expect(result?.data.name).toBe('test');
		});

		it('should preserve entry metadata', async () => {
			const entry = createEntry('data', 'etag-123', DEFAULT_STALE_TIME_MS);
			await cache.set('key1', entry);

			const result = await cache.get<string>('key1');
			expect(result?.etag).toBe('etag-123');
			expect(result?.staleTime).toBe(DEFAULT_STALE_TIME_MS);
		});
	});

	describe('two-tier lookup', () => {
		it('should check memory first', async () => {
			await cache.set('key1', createEntry('value1'));

			// Modify storage directly to verify memory is checked first
			mockStorage.setItem('test:key1', JSON.stringify(createEntry('storage-value')));

			const result = await cache.get<string>('key1');
			// Should get memory value, not storage value
			expect(result?.data).toBe('value1');
		});

		it('should fall back to storage when not in memory', async () => {
			// Directly write to storage (simulating page reload scenario)
			mockStorage.setItem('test:key1', JSON.stringify(createEntry('storage-only')));

			const result = await cache.get<string>('key1');
			expect(result?.data).toBe('storage-only');
		});

		it('should return undefined when not in either tier', async () => {
			const result = await cache.get('nonexistent');
			expect(result).toBeUndefined();
		});
	});

	describe('storage promotion to memory', () => {
		it('should promote storage hits to memory', async () => {
			// Write directly to storage only
			const entry = createEntry('storage-value');
			mockStorage.setItem('test:promoted', JSON.stringify(entry));

			// First access - comes from storage
			const result1 = await cache.get<string>('promoted');
			expect(result1?.data).toBe('storage-value');

			// Clear storage to verify second access comes from memory
			mockStorage.removeItem('test:promoted');

			// Second access - should come from memory (promoted)
			const result2 = await cache.get<string>('promoted');
			expect(result2?.data).toBe('storage-value');
		});
	});

	describe('write-through', () => {
		it('should write to both memory and storage', async () => {
			await cache.set('key1', createEntry('value1'));

			// Verify in storage
			const storageRaw = mockStorage.getItem('test:key1');
			expect(storageRaw).not.toBeNull();
			const storageEntry = JSON.parse(storageRaw!);
			expect(storageEntry.data).toBe('value1');

			// Verify memory by clearing storage and checking get still works
			mockStorage.removeItem('test:key1');
			const result = await cache.get<string>('key1');
			expect(result?.data).toBe('value1');
		});

		it('should overwrite existing entries in both tiers', async () => {
			await cache.set('key1', createEntry('value1'));
			await cache.set('key1', createEntry('value2'));

			const result = await cache.get<string>('key1');
			expect(result?.data).toBe('value2');

			const storageEntry = JSON.parse(mockStorage.getItem('test:key1')!);
			expect(storageEntry.data).toBe('value2');
		});
	});

	describe('delete', () => {
		it('should delete from both tiers', async () => {
			await cache.set('key1', createEntry('value1'));
			await cache.delete('key1');

			// Memory check
			const result = await cache.get('key1');
			expect(result).toBeUndefined();

			// Storage check
			expect(mockStorage.getItem('test:key1')).toBeNull();
		});

		it('should not throw when deleting nonexistent key', async () => {
			// Should resolve without throwing
			await cache.delete('nonexistent');
		});
	});

	describe('deleteByPrefix', () => {
		it('should delete matching entries from both tiers', async () => {
			await cache.set('monitors:1', createEntry('m1'));
			await cache.set('monitors:2', createEntry('m2'));
			await cache.set('alerts:1', createEntry('a1'));

			await cache.deleteByPrefix('monitors');

			expect(await cache.get('monitors:1')).toBeUndefined();
			expect(await cache.get('monitors:2')).toBeUndefined();
			expect(await cache.get('alerts:1')).toBeDefined();

			// Verify storage
			expect(mockStorage.getItem('test:monitors:1')).toBeNull();
			expect(mockStorage.getItem('test:monitors:2')).toBeNull();
			expect(mockStorage.getItem('test:alerts:1')).not.toBeNull();
		});

		it('should not throw when prefix matches nothing', async () => {
			await cache.set('key1', createEntry('value1'));
			// Should resolve without throwing
			await cache.deleteByPrefix('xyz');
			expect(await cache.get('key1')).toBeDefined();
		});
	});

	describe('clear', () => {
		it('should clear both tiers', async () => {
			await cache.set('a', createEntry('a'));
			await cache.set('b', createEntry('b'));
			await cache.set('c', createEntry('c'));

			await cache.clear();

			expect(await cache.get('a')).toBeUndefined();
			expect(await cache.get('b')).toBeUndefined();
			expect(await cache.get('c')).toBeUndefined();

			// Verify storage is cleared
			expect(mockStorage._data.size).toBe(0);
		});

		it('should not throw when clearing empty cache', async () => {
			// Should resolve without throwing
			await cache.clear();
		});
	});

	describe('CacheProvider interface compliance', () => {
		it('should return Promises from all methods', () => {
			const entry = createEntry('value');

			expect(cache.get('key')).toBeInstanceOf(Promise);
			expect(cache.set('key', entry)).toBeInstanceOf(Promise);
			expect(cache.delete('key')).toBeInstanceOf(Promise);
			expect(cache.deleteByPrefix('prefix')).toBeInstanceOf(Promise);
			expect(cache.clear()).toBeInstanceOf(Promise);
		});
	});

	describe('E-Tag handling', () => {
		it('should preserve E-Tag values through cache operations', async () => {
			const entry = createEntry({ id: 1 }, 'W/"abc123"');
			await cache.set('resource', entry);

			const result = await cache.get<{ id: number }>('resource');
			expect(result?.etag).toBe('W/"abc123"');
		});

		it('should support updating E-Tag on set', async () => {
			const entry1 = createEntry({ id: 1 }, 'etag-v1');
			await cache.set('resource', entry1);

			const entry2 = createEntry({ id: 1, updated: true }, 'etag-v2');
			await cache.set('resource', entry2);

			const result = await cache.get<{ id: number; updated?: boolean }>('resource');
			expect(result?.etag).toBe('etag-v2');
			expect(result?.data.updated).toBe(true);
		});
	});

	describe('memory LRU with storage persistence', () => {
		it('should evict from memory but retain in storage', async () => {
			// Create cache with small memory limit
			const smallCache = new ETagCacheProvider({
				memory: { maxEntries: 2 },
				storage: { storage: mockStorage, prefix: 'lru:' }
			});

			await smallCache.set('a', createEntry('a'));
			await smallCache.set('b', createEntry('b'));
			await smallCache.set('c', createEntry('c')); // Evicts 'a' from memory

			// 'a' evicted from memory but should still be in storage
			// Clear storage for 'b' and 'c' to verify 'a' comes from storage
			// Actually, we just need to verify 'a' is still accessible via storage
			expect(mockStorage.getItem('lru:a')).not.toBeNull();

			// Should be able to get 'a' via storage fallback
			const result = await smallCache.get<string>('a');
			expect(result?.data).toBe('a');
		});
	});
});
