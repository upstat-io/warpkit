import { describe, it, expect } from 'vitest';
import { NoCacheProvider } from './NoCacheProvider';
import type { CacheEntry } from './types';

describe('NoCacheProvider', () => {
	it('should return undefined for any key when get() is called', async () => {
		const cache = new NoCacheProvider();

		const result = await cache.get('test-key');

		expect(result).toBeUndefined();
	});

	it('should return undefined even after set() is called', async () => {
		const cache = new NoCacheProvider();
		const entry: CacheEntry<string> = {
			data: 'test-data',
			timestamp: Date.now()
		};

		await cache.set('test-key', entry);
		const result = await cache.get<string>('test-key');

		expect(result).toBeUndefined();
	});

	it('should complete set() without error', async () => {
		const cache = new NoCacheProvider();
		const entry: CacheEntry<{ id: number }> = {
			data: { id: 1 },
			timestamp: Date.now(),
			etag: '"abc123"'
		};

		// Should not throw
		await expect(cache.set('test-key', entry)).resolves.toBeUndefined();
	});

	it('should complete delete() without error for non-existent key', async () => {
		const cache = new NoCacheProvider();

		// Should not throw even for non-existent key
		await expect(cache.delete('non-existent')).resolves.toBeUndefined();
	});

	it('should complete deleteByPrefix() without error', async () => {
		const cache = new NoCacheProvider();

		// Should not throw
		await expect(cache.deleteByPrefix('test:')).resolves.toBeUndefined();
	});

	it('should complete clear() without error', async () => {
		const cache = new NoCacheProvider();

		// Should not throw
		await expect(cache.clear()).resolves.toBeUndefined();
	});

	it('should implement CacheProvider interface', () => {
		const cache = new NoCacheProvider();

		// Type check - all methods exist
		expect(typeof cache.get).toBe('function');
		expect(typeof cache.set).toBe('function');
		expect(typeof cache.delete).toBe('function');
		expect(typeof cache.deleteByPrefix).toBe('function');
		expect(typeof cache.clear).toBe('function');
	});
});
