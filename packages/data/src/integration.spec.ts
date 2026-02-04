/**
 * Integration Tests: DataClient + ETagCacheProvider
 *
 * Tests the full data flow with real DataClient and ETagCacheProvider.
 * Verifies caching, invalidation, and E-Tag conditional request handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { DataClient } from './DataClient';
import { ETagCacheProvider } from '@warpkit/cache';
import type { DataClientConfig, DataKey, DataKeyConfig } from './types';

// Module augmentation for test data keys
declare module './types' {
	interface DataRegistry {
		'test:monitors': Array<{ id: string; name: string }>;
		'test:monitor': { id: string; name: string };
	}
}

describe('DataClient + ETagCacheProvider Integration', () => {
	let client: DataClient;
	let cache: ETagCacheProvider;
	let originalFetch: typeof globalThis.fetch;
	let mockFetch: Mock;

	const testConfig: DataClientConfig = {
		baseUrl: 'http://localhost/api',
		keys: {
			'test:monitors': {
				key: 'test:monitors',
				url: '/monitors',
				staleTime: 5000 // 5 seconds for testing
			},
			'test:monitor': {
				key: 'test:monitor',
				url: '/monitors/:id',
				staleTime: 5000
			}
		} as Record<DataKey, DataKeyConfig<DataKey>>
	};

	beforeEach(() => {
		// Store original fetch
		originalFetch = globalThis.fetch;

		// Create mock fetch - use unknown intermediate cast for type compatibility
		mockFetch = vi.fn();
		globalThis.fetch = mockFetch as unknown as typeof fetch;

		// Create real cache and client
		cache = new ETagCacheProvider({
			memory: { maxEntries: 100 },
			storage: { prefix: 'test:' }
		});
		client = new DataClient(testConfig, { cache });
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.clearAllMocks();
	});

	describe('cache integration', () => {
		it('should cache response after successful fetch', async () => {
			const testData = [{ id: '1', name: 'Monitor 1' }];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers({ etag: '"abc123"' }),
				json: async () => testData
			});

			// First fetch - should hit network
			const result = await client.fetch('test:monitors');

			expect(result.data).toEqual(testData);
			expect(result.fromCache).toBe(false);
			expect(result.notModified).toBe(false);

			// Verify data is cached
			const cached = await cache.get('test:monitors');
			expect(cached?.data).toEqual(testData);
			expect(cached?.etag).toBe('"abc123"');
		});

		it('should return fresh cached data without network request', async () => {
			const testData = [{ id: '1', name: 'Monitor 1' }];

			// Pre-populate cache with fresh data
			await cache.set('test:monitors', {
				data: testData,
				etag: '"abc123"',
				timestamp: Date.now(),
				staleTime: 60000 // Fresh for 60 seconds
			});

			// Fetch should use cache, not network
			const result = await client.fetch('test:monitors');

			expect(result.data).toEqual(testData);
			expect(result.fromCache).toBe(true);
			expect(result.notModified).toBe(false);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('should revalidate stale cache with E-Tag and handle 304', async () => {
			const testData = [{ id: '1', name: 'Monitor 1' }];

			// Pre-populate cache with stale data (timestamp in past, staleTime expired)
			await cache.set('test:monitors', {
				data: testData,
				etag: '"abc123"',
				timestamp: Date.now() - 10000, // 10 seconds ago
				staleTime: 5000 // Stale after 5 seconds
			});

			// Server returns 304 Not Modified
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 304,
				headers: new Headers()
			});

			// Fetch should revalidate and return cached data
			const result = await client.fetch('test:monitors');

			expect(result.data).toEqual(testData);
			expect(result.fromCache).toBe(true);
			expect(result.notModified).toBe(true);

			// Verify E-Tag was sent
			expect(mockFetch).toHaveBeenCalledTimes(1);
			const request = mockFetch.mock.calls[0][0] as Request;
			expect(request.headers.get('If-None-Match')).toBe('"abc123"');
		});

		it('should update cache when server returns new data', async () => {
			const oldData = [{ id: '1', name: 'Old Name' }];
			const newData = [{ id: '1', name: 'New Name' }];

			// Pre-populate cache with stale data
			await cache.set('test:monitors', {
				data: oldData,
				etag: '"old-etag"',
				timestamp: Date.now() - 10000,
				staleTime: 5000
			});

			// Server returns new data
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers({ etag: '"new-etag"' }),
				json: async () => newData
			});

			// Fetch should return new data
			const result = await client.fetch('test:monitors');

			expect(result.data).toEqual(newData);
			expect(result.fromCache).toBe(false);
			expect(result.notModified).toBe(false);

			// Verify cache updated
			const cached = await cache.get('test:monitors');
			expect(cached?.data).toEqual(newData);
			expect(cached?.etag).toBe('"new-etag"');
		});
	});

	describe('invalidation', () => {
		it('should remove entry from cache on invalidate', async () => {
			const testData = [{ id: '1', name: 'Monitor 1' }];

			// Pre-populate cache
			await cache.set('test:monitors', {
				data: testData,
				timestamp: Date.now(),
				staleTime: 60000
			});

			// Verify it's cached
			expect(await cache.get('test:monitors')).toBeDefined();

			// Invalidate
			await client.invalidate('test:monitors');

			// Verify removed
			expect(await cache.get('test:monitors')).toBeUndefined();
		});

		it('should remove entries by prefix', async () => {
			// Pre-populate cache with multiple entries
			await cache.set('test:monitors', {
				data: [{ id: '1', name: 'Monitor 1' }],
				timestamp: Date.now(),
				staleTime: 60000
			});
			await cache.set('test:monitor?id=1', {
				data: { id: '1', name: 'Monitor 1' },
				timestamp: Date.now(),
				staleTime: 60000
			});
			await cache.set('test:monitor?id=2', {
				data: { id: '2', name: 'Monitor 2' },
				timestamp: Date.now(),
				staleTime: 60000
			});

			// Invalidate by prefix
			await client.invalidateByPrefix('test:monitor');

			// All test:monitor* entries should be removed
			expect(await cache.get('test:monitors')).toBeUndefined();
			expect(await cache.get('test:monitor?id=1')).toBeUndefined();
			expect(await cache.get('test:monitor?id=2')).toBeUndefined();
		});
	});

	describe('URL parameters', () => {
		it('should build correct cache key with params', async () => {
			const testData = { id: '123', name: 'Monitor 123' };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers(),
				json: async () => testData
			});

			// Fetch with params
			await client.fetch('test:monitor', { id: '123' });

			// Verify correct URL was called
			expect(mockFetch).toHaveBeenCalledTimes(1);
			const request = mockFetch.mock.calls[0][0] as Request;
			expect(request.url).toBe('http://localhost/api/monitors/123');

			// Verify cached with params in key
			const cached = await cache.get('test:monitor?id=123');
			expect(cached?.data).toEqual(testData);
		});
	});

	describe('error handling', () => {
		it('should not cache failed responses', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error'
			});

			// Fetch should throw
			await expect(client.fetch('test:monitors')).rejects.toThrow('HTTP 500');

			// Verify nothing cached
			expect(await cache.get('test:monitors')).toBeUndefined();
		});

		it('should preserve cache on network error with stale data', async () => {
			const testData = [{ id: '1', name: 'Monitor 1' }];

			// Pre-populate cache with stale data
			await cache.set('test:monitors', {
				data: testData,
				etag: '"abc123"',
				timestamp: Date.now() - 10000,
				staleTime: 5000
			});

			// Network error
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			// Fetch should throw (stale-while-revalidate not implemented in this version)
			await expect(client.fetch('test:monitors')).rejects.toThrow('Network error');

			// Cache should be preserved for potential retry
			const cached = await cache.get('test:monitors');
			expect(cached?.data).toEqual(testData);
		});
	});
});
