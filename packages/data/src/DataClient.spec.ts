import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { DataClient } from './DataClient';
import type { CacheEntry, CacheProvider, DataClientConfig, DataEventEmitter } from './types';

// Augment DataRegistry for tests
// NOTE: All test files share the merged type, so we include keys from integration.spec.ts too
declare module './types' {
	interface DataRegistry {
		monitors: unknown[];
		'monitors/:id': unknown;
		'projects/:projectId/monitors': unknown[];
		'test:monitors': Array<{ id: string; name: string }>;
		'test:monitor': { id: string; name: string };
	}
}

// Mock fetch globally - assign directly to globalThis for Bun compatibility
const mockFetch = vi.fn() as ReturnType<typeof vi.fn> & typeof fetch;
const originalFetch = globalThis.fetch;
globalThis.fetch = mockFetch;

// Test config - use absolute URL for Node.js compatibility
// NOTE: Include all keys from merged QueryKeyRegistry (both spec files)
const createTestConfig = (overrides?: Partial<DataClientConfig>): DataClientConfig => ({
	baseUrl: 'http://localhost/api',
	keys: {
		monitors: { key: 'monitors', url: '/monitors', staleTime: 30000 },
		'monitors/:id': { key: 'monitors/:id', url: '/monitors/:id' },
		'projects/:projectId/monitors': {
			key: 'projects/:projectId/monitors',
			url: '/projects/:projectId/monitors'
		},
		'test:monitors': { key: 'test:monitors', url: '/test-monitors' },
		'test:monitor': { key: 'test:monitor', url: '/test-monitor/:id' }
	},
	...overrides
});

// Mock cache provider - use explicit function types for vi.fn
const createMockCache = (): CacheProvider & { store: Map<string, CacheEntry<unknown>> } => {
	const store = new Map<string, CacheEntry<unknown>>();
	return {
		store,
		get: vi.fn().mockImplementation(async (key: string) => store.get(key)),
		set: vi.fn().mockImplementation(async (key: string, entry: CacheEntry<unknown>) => {
			store.set(key, entry);
		}),
		delete: vi.fn().mockImplementation(async (key: string) => {
			store.delete(key);
		}),
		deleteByPrefix: vi.fn().mockImplementation(async (prefix: string) => {
			for (const key of store.keys()) {
				if (key.startsWith(prefix)) store.delete(key);
			}
		}),
		clear: vi.fn().mockImplementation(async () => {
			store.clear();
		})
	};
};

// Helper to create mock Response
const createMockResponse = (data: unknown, options?: { status?: number; etag?: string }) => {
	const { status = 200, etag } = options ?? {};
	const headers = new Headers();
	if (etag) headers.set('etag', etag);

	return new Response(JSON.stringify(data), {
		status,
		statusText: status === 200 ? 'OK' : status === 304 ? 'Not Modified' : 'Error',
		headers
	});
};

// Restore fetch after all tests
afterAll(() => {
	globalThis.fetch = originalFetch;
});

describe('DataClient', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('constructor', () => {
		it('should create client with config', () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			expect(client.getKeyConfig('monitors')).toEqual(config.keys.monitors);
		});

		it('should use NoCacheProvider by default when no cache provided', async () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(createMockResponse({ data: 'test' }));

			await client.fetch('monitors');

			// Second fetch should hit network again (no cache)
			mockFetch.mockResolvedValueOnce(createMockResponse({ data: 'test2' }));
			const result = await client.fetch('monitors');

			expect(result.fromCache).toBe(false);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('should accept custom cache provider', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			const client = new DataClient(config, { cache });

			mockFetch.mockResolvedValueOnce(createMockResponse({ id: 1 }, { etag: '"abc"' }));
			await client.fetch('monitors');

			expect(cache.set).toHaveBeenCalled();
		});

		it('should accept custom event emitter', () => {
			const config = createTestConfig();
			const events: DataEventEmitter = { on: vi.fn() };
			const client = new DataClient(config, { events });

			expect(client.getEvents()).toBe(events);
		});
	});

	describe('fetch()', () => {
		it('should fetch data successfully', async () => {
			const config = createTestConfig();
			const client = new DataClient(config);
			const responseData = [{ id: 1, name: 'Monitor 1' }];

			mockFetch.mockResolvedValueOnce(createMockResponse(responseData));

			const result = await client.fetch('monitors');

			expect(result.data).toEqual(responseData);
			expect(result.fromCache).toBe(false);
			expect(result.notModified).toBe(false);
		});

		it('should throw for unknown query key', async () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			// @ts-expect-error - Testing runtime error for unknown key
			await expect(client.fetch('unknown')).rejects.toThrow('Unknown data key: unknown');
		});

		it('should interpolate URL parameters', async () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(createMockResponse({ id: '123' }));

			await client.fetch('monitors/:id', { id: '123' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/api/monitors/123')
				})
			);
		});

		it('should throw when URL parameters are missing', async () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			await expect(client.fetch('monitors/:id', {})).rejects.toThrow('Missing param: id');
		});

		it('should interpolate multiple URL parameters', async () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(createMockResponse([]));

			await client.fetch('projects/:projectId/monitors', { projectId: 'proj-1' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/api/projects/proj-1/monitors')
				})
			);
		});

		it('should URL-encode parameter values', async () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(createMockResponse({}));

			await client.fetch('monitors/:id', { id: 'special/value' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/api/monitors/special%2Fvalue')
				})
			);
		});

		it('should prepend baseUrl', async () => {
			const config = createTestConfig({ baseUrl: 'https://api.example.com' });
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(createMockResponse([]));

			await client.fetch('monitors');

			expect(mockFetch).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://api.example.com/monitors'
				})
			);
		});

		it('should work without baseUrl when URL is absolute', async () => {
			// Override monitors URL to be absolute without baseUrl
			const config = createTestConfig({
				baseUrl: undefined,
				keys: {
					monitors: { key: 'monitors', url: 'http://localhost/monitors', staleTime: 30000 },
					'monitors/:id': { key: 'monitors/:id', url: 'http://localhost/monitors/:id' },
					'projects/:projectId/monitors': {
						key: 'projects/:projectId/monitors',
						url: 'http://localhost/projects/:projectId/monitors'
					},
					'test:monitors': { key: 'test:monitors', url: 'http://localhost/test-monitors' },
					'test:monitor': { key: 'test:monitor', url: 'http://localhost/test-monitor/:id' }
				}
			});
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(createMockResponse([]));

			await client.fetch('monitors');

			expect(mockFetch).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'http://localhost/monitors'
				})
			);
		});

		it('should throw on non-OK response', async () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404, statusText: 'Not Found' }));

			await expect(client.fetch('monitors')).rejects.toThrow('HTTP 404: Not Found');
		});
	});

	describe('cache integration', () => {
		it('should store response in cache with etag', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			const client = new DataClient(config, { cache });
			const responseData = { id: 1 };

			mockFetch.mockResolvedValueOnce(createMockResponse(responseData, { etag: '"abc123"' }));

			await client.fetch('monitors');

			expect(cache.set).toHaveBeenCalledWith(
				'monitors',
				expect.objectContaining({
					data: responseData,
					etag: '"abc123"',
					staleTime: 30000
				})
			);
		});

		it('should return fresh cached data without network request', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			const cachedData = { id: 1, cached: true };
			cache.store.set('monitors', {
				data: cachedData,
				timestamp: Date.now(), // Fresh
				staleTime: 30000
			});
			const client = new DataClient(config, { cache });

			const result = await client.fetch('monitors');

			expect(result.data).toEqual(cachedData);
			expect(result.fromCache).toBe(true);
			expect(result.notModified).toBe(false);
			expect(mockFetch).not.toHaveBeenCalled(); // No network request
		});

		it('should fetch from network when cached data is stale', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			cache.store.set('monitors', {
				data: { old: true },
				timestamp: Date.now() - 60000, // 60 seconds ago
				staleTime: 30000 // 30 second stale time = stale
			});
			const client = new DataClient(config, { cache });

			mockFetch.mockResolvedValueOnce(createMockResponse({ new: true }));

			const result = await client.fetch('monitors');

			expect(result.data).toEqual({ new: true });
			expect(result.fromCache).toBe(false);
			expect(mockFetch).toHaveBeenCalled();
		});

		it('should fetch from network when cached data has no staleTime', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			cache.store.set('monitors', {
				data: { old: true },
				timestamp: Date.now()
				// No staleTime = always stale
			});
			const client = new DataClient(config, { cache });

			mockFetch.mockResolvedValueOnce(createMockResponse({ new: true }));

			const result = await client.fetch('monitors');

			expect(result.fromCache).toBe(false);
			expect(mockFetch).toHaveBeenCalled();
		});

		it('should send If-None-Match header when cache has etag and is stale', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			cache.store.set('monitors', {
				data: { old: true },
				etag: '"cached-etag"',
				timestamp: Date.now() - 60000, // Stale
				staleTime: 30000
			});
			const client = new DataClient(config, { cache });

			mockFetch.mockResolvedValueOnce(createMockResponse({ new: true }));

			await client.fetch('monitors');

			const request = mockFetch.mock.calls[0][0] as Request;
			expect(request.headers.get('If-None-Match')).toBe('"cached-etag"');
		});

		it('should return cached data on 304 response', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			const cachedData = { id: 1, cached: true };
			cache.store.set('monitors', {
				data: cachedData,
				etag: '"etag"',
				timestamp: Date.now() - 60000, // Stale
				staleTime: 30000
			});
			const client = new DataClient(config, { cache });

			mockFetch.mockResolvedValueOnce(new Response(null, { status: 304 }));

			const result = await client.fetch('monitors');

			expect(result.data).toEqual(cachedData);
			expect(result.fromCache).toBe(true);
			expect(result.notModified).toBe(true);
		});
	});

	describe('onRequest hook', () => {
		it('should call onRequest hook before fetch', async () => {
			const onRequest = vi.fn((req: Request) => {
				const newHeaders = new Headers(req.headers);
				newHeaders.set('Authorization', 'Bearer token');
				return new Request(req.url, {
					method: req.method,
					headers: newHeaders,
					signal: req.signal
				});
			});
			const config = createTestConfig({ onRequest });
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(createMockResponse({}));

			await client.fetch('monitors');

			expect(onRequest).toHaveBeenCalled();
			const request = mockFetch.mock.calls[0][0] as Request;
			expect(request.headers.get('Authorization')).toBe('Bearer token');
		});

		it('should support async onRequest hook', async () => {
			const onRequest = vi.fn(async (req: Request) => {
				await Promise.resolve();
				return req;
			});
			const config = createTestConfig({ onRequest });
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(createMockResponse({}));

			await client.fetch('monitors');

			expect(onRequest).toHaveBeenCalled();
		});
	});

	describe('timeout', () => {
		it('should abort fetch when timeout is reached', async () => {
			vi.useRealTimers(); // Use real timers for this test
			const config = createTestConfig({ timeout: 50 }); // Very short timeout
			const client = new DataClient(config);

			// Create a promise that respects the AbortSignal
			mockFetch.mockImplementation((request: Request) => {
				return new Promise((resolve, reject) => {
					const timeoutId = setTimeout(() => resolve(createMockResponse({})), 200);
					request.signal.addEventListener('abort', () => {
						clearTimeout(timeoutId);
						reject(new DOMException('Aborted', 'AbortError'));
					});
				});
			});

			await expect(client.fetch('monitors')).rejects.toThrow();
			vi.useFakeTimers(); // Restore fake timers
		});

		it('should clear timeout on successful fetch', async () => {
			const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
			const config = createTestConfig();
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(createMockResponse({}));

			await client.fetch('monitors');

			// Verify clearTimeout was called (defensive cleanup in try and finally blocks)
			expect(clearTimeoutSpy).toHaveBeenCalled();

			// If timeout wasn't cleared, this would cause issues
			vi.advanceTimersByTime(60000);

			clearTimeoutSpy.mockRestore();
		});
	});

	describe('invalidate()', () => {
		it('should remove entry from cache', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			cache.store.set('monitors', { data: [], timestamp: Date.now() });
			const client = new DataClient(config, { cache });

			await client.invalidate('monitors');

			expect(cache.delete).toHaveBeenCalledWith('monitors');
		});

		it('should build cache key with params', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			const client = new DataClient(config, { cache });

			await client.invalidate('monitors/:id', { id: '123' });

			expect(cache.delete).toHaveBeenCalledWith('monitors/:id?id=123');
		});
	});

	describe('invalidateByPrefix()', () => {
		it('should remove all matching entries from cache', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			const client = new DataClient(config, { cache });

			await client.invalidateByPrefix('monitors');

			expect(cache.deleteByPrefix).toHaveBeenCalledWith('monitors');
		});
	});

	describe('getKeyConfig()', () => {
		it('should return config for existing key', () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			const keyConfig = client.getKeyConfig('monitors');

			expect(keyConfig).toEqual(config.keys.monitors);
		});

		it('should return undefined for unknown key', () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			// @ts-expect-error - Testing runtime behavior for unknown key
			const keyConfig = client.getKeyConfig('unknown');

			expect(keyConfig).toBeUndefined();
		});
	});

	describe('getEvents()', () => {
		it('should return null when no events configured', () => {
			const config = createTestConfig();
			const client = new DataClient(config);

			expect(client.getEvents()).toBeNull();
		});

		it('should return event emitter when configured', () => {
			const config = createTestConfig();
			const events: DataEventEmitter = { on: vi.fn() };
			const client = new DataClient(config, { events });

			expect(client.getEvents()).toBe(events);
		});
	});

	describe('setCache()', () => {
		it('should allow late cache injection', async () => {
			const config = createTestConfig();
			const client = new DataClient(config);
			const cache = createMockCache();

			client.setCache(cache);

			mockFetch.mockResolvedValueOnce(createMockResponse({ test: true }));
			await client.fetch('monitors');

			expect(cache.set).toHaveBeenCalled();
		});
	});

	describe('setEvents()', () => {
		it('should allow late events injection', () => {
			const config = createTestConfig();
			const client = new DataClient(config);
			const events: DataEventEmitter = { on: vi.fn() };

			expect(client.getEvents()).toBeNull();

			client.setEvents(events);

			expect(client.getEvents()).toBe(events);
		});
	});

	describe('cache key building', () => {
		it('should use key directly when no params', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			const client = new DataClient(config, { cache });

			mockFetch.mockResolvedValueOnce(createMockResponse({}));
			await client.fetch('monitors');

			expect(cache.set).toHaveBeenCalledWith('monitors', expect.any(Object));
		});

		it('should sort params for consistent cache keys', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			const client = new DataClient(config, { cache });

			mockFetch.mockResolvedValueOnce(createMockResponse({}));
			await client.fetch('monitors/:id', { id: '123' });

			expect(cache.set).toHaveBeenCalledWith('monitors/:id?id=123', expect.any(Object));
		});

		it('should URL-encode param values in cache key', async () => {
			const config = createTestConfig();
			const cache = createMockCache();
			const client = new DataClient(config, { cache });

			mockFetch.mockResolvedValueOnce(createMockResponse({}));
			await client.fetch('monitors/:id', { id: 'special/value&chars=test' });

			expect(cache.set).toHaveBeenCalledWith(
				'monitors/:id?id=special%2Fvalue%26chars%3Dtest',
				expect.any(Object)
			);
		});
	});

	describe('URL function support', () => {
		it('should support URL as function', async () => {
			const config = createTestConfig({
				baseUrl: 'http://localhost/api',
				keys: {
					monitors: {
						key: 'monitors',
						url: (params: Record<string, string>) => `/custom/${params.type}/${params.id}`
					},
					'monitors/:id': { key: 'monitors/:id', url: '/monitors/:id' },
					'projects/:projectId/monitors': {
						key: 'projects/:projectId/monitors',
						url: '/projects/:projectId/monitors'
					},
					'test:monitors': { key: 'test:monitors', url: '/test-monitors' },
					'test:monitor': { key: 'test:monitor', url: '/test-monitor/:id' }
				}
			});
			const client = new DataClient(config);

			mockFetch.mockResolvedValueOnce(createMockResponse({}));

			await client.fetch('monitors', { type: 'foo', id: 'bar' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'http://localhost/api/custom/foo/bar'
				})
			);
		});
	});
});
