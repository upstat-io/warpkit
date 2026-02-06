/**
 * StorageCache Unit Tests
 *
 * Tests localStorage-backed cache operations with mocked storage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageCache } from './StorageCache.js';
import { createEntry, createMockStorage } from './test-utils.js';
import { onErrorReport, _resetChannel } from '@warpkit/errors';
import type { ErrorReport } from '@warpkit/errors';

describe('StorageCache', () => {
	let mockStorage: ReturnType<typeof createMockStorage>;
	let cache: StorageCache;

	beforeEach(() => {
		mockStorage = createMockStorage();
		cache = new StorageCache({ storage: mockStorage, prefix: 'test:' });
	});

	describe('constructor', () => {
		it('should use default prefix when no options provided', () => {
			const defaultCache = new StorageCache({ storage: mockStorage });
			defaultCache.set('key', createEntry('value'));

			expect(mockStorage.getItem('warpkit:key')).not.toBeNull();
		});

		it('should use custom prefix', () => {
			cache.set('key', createEntry('value'));
			expect(mockStorage.getItem('test:key')).not.toBeNull();
		});

		it('should handle undefined storage gracefully', () => {
			const noStorageCache = new StorageCache({ storage: undefined });

			// Should not throw
			expect(() => noStorageCache.set('key', createEntry('value'))).not.toThrow();
			expect(noStorageCache.get('key')).toBeUndefined();
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

		it('should handle corrupted JSON gracefully', () => {
			// Manually store invalid JSON
			mockStorage.setItem('test:corrupted', 'not valid json{{{');

			const result = cache.get('corrupted');
			expect(result).toBeUndefined();

			// Corrupted entry should be deleted
			expect(mockStorage.getItem('test:corrupted')).toBeNull();
		});

		it('should return undefined when storage is not available', () => {
			const noStorageCache = new StorageCache({ storage: undefined });
			expect(noStorageCache.get('key')).toBeUndefined();
		});
	});

	describe('set', () => {
		it('should store an entry as JSON', () => {
			const entry = createEntry({ name: 'test' });
			cache.set('key1', entry);

			const raw = mockStorage.getItem('test:key1');
			expect(raw).not.toBeNull();

			const parsed = JSON.parse(raw!);
			expect(parsed.data.name).toBe('test');
		});

		it('should overwrite existing entry', () => {
			cache.set('key1', createEntry('value1'));
			cache.set('key1', createEntry('value2'));

			const result = cache.get<string>('key1');
			expect(result?.data).toBe('value2');
		});

		it('should fail silently when quota is exceeded and report to error channel', () => {
			_resetChannel();
			const reports: ErrorReport[] = [];
			onErrorReport((report) => reports.push(report));

			const quotaStorage = createMockStorage();
			quotaStorage.setItem = () => {
				throw new Error('QuotaExceededError');
			};

			const quotaCache = new StorageCache({ storage: quotaStorage, prefix: 'test:' });

			// Should not throw
			expect(() => quotaCache.set('key', createEntry('value'))).not.toThrow();

			// Error should be reported to channel
			expect(reports).toHaveLength(1);
			expect(reports[0].source).toBe('cache');
			expect(reports[0].severity).toBe('warning');
			expect(reports[0].error.message).toBe('QuotaExceededError');
			expect(reports[0].context).toEqual({ operation: 'set', key: 'key' });
		});

		it('should not throw when storage is not available', () => {
			const noStorageCache = new StorageCache({ storage: undefined });
			expect(() => noStorageCache.set('key', createEntry('value'))).not.toThrow();
		});
	});

	describe('delete', () => {
		it('should remove an existing entry', () => {
			cache.set('key1', createEntry('value1'));
			cache.delete('key1');

			expect(cache.get('key1')).toBeUndefined();
			expect(mockStorage.getItem('test:key1')).toBeNull();
		});

		it('should not throw when deleting nonexistent key', () => {
			expect(() => cache.delete('nonexistent')).not.toThrow();
		});

		it('should not throw when storage is not available', () => {
			const noStorageCache = new StorageCache({ storage: undefined });
			expect(() => noStorageCache.delete('key')).not.toThrow();
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
		});

		it('should not throw when prefix matches nothing', () => {
			cache.set('key1', createEntry('value1'));

			expect(() => cache.deleteByPrefix('xyz')).not.toThrow();
			expect(cache.get('key1')).toBeDefined();
		});

		it('should combine with cache prefix', () => {
			// Our cache has prefix 'test:'
			// So 'monitors' should delete keys like 'test:monitors:xxx'
			cache.set('monitors:1', createEntry('m1'));
			cache.set('other', createEntry('other'));

			cache.deleteByPrefix('monitors');

			expect(mockStorage.getItem('test:monitors:1')).toBeNull();
			expect(mockStorage.getItem('test:other')).not.toBeNull();
		});

		it('should not throw when storage is not available', () => {
			const noStorageCache = new StorageCache({ storage: undefined });
			expect(() => noStorageCache.deleteByPrefix('test')).not.toThrow();
		});
	});

	describe('clear', () => {
		it('should remove all entries with our prefix', () => {
			cache.set('a', createEntry('a'));
			cache.set('b', createEntry('b'));

			cache.clear();

			expect(cache.get('a')).toBeUndefined();
			expect(cache.get('b')).toBeUndefined();
		});

		it('should not affect entries with different prefix', () => {
			// Add entry with different prefix directly
			mockStorage.setItem('other:key', JSON.stringify(createEntry('value')));
			cache.set('mykey', createEntry('myvalue'));

			cache.clear();

			expect(mockStorage.getItem('other:key')).not.toBeNull();
			expect(mockStorage.getItem('test:mykey')).toBeNull();
		});

		it('should not throw when clearing empty cache', () => {
			expect(() => cache.clear()).not.toThrow();
		});

		it('should not throw when storage is not available', () => {
			const noStorageCache = new StorageCache({ storage: undefined });
			expect(() => noStorageCache.clear()).not.toThrow();
		});
	});

	describe('JSON serialization', () => {
		it('should round-trip complex objects through JSON storage', () => {
			const entry = createEntry({
				id: 123,
				name: 'Test Monitor',
				tags: ['prod', 'critical'],
				config: { interval: 60, timeout: 30 }
			});

			cache.set('monitor', entry);
			const result = cache.get<typeof entry.data>('monitor');

			expect(result?.data).toEqual(entry.data);
		});

		it('should handle null values in data', () => {
			const entry = createEntry<string | null>(null);
			cache.set('nullable', entry);

			const result = cache.get<string | null>('nullable');
			expect(result?.data).toBeNull();
		});

		it('should handle arrays', () => {
			const entry = createEntry([1, 2, 3, 4, 5]);
			cache.set('array', entry);

			const result = cache.get<number[]>('array');
			expect(result?.data).toEqual([1, 2, 3, 4, 5]);
		});
	});
});
