/**
 * Mock DataClient Factory for Testing
 *
 * Creates a pre-configured mock DataClient instance for testing components
 * that use @warpkit/data. Provides methods to configure responses and track calls.
 */

import { vi } from 'vitest';
import type {
	DataKey,
	DataRegistry,
	DataType,
	FetchResult,
	DataKeyConfig,
	DataEventEmitter
} from '../../packages/data/src/types.js';

/**
 * Options for createMockDataClient.
 */
export interface MockDataClientOptions {
	/** Pre-configured key configs for getKeyConfig() */
	keyConfigs?: Map<DataKey, DataKeyConfig<DataKey>>;
	/** Event emitter for invalidation subscriptions */
	events?: DataEventEmitter;
}

/**
 * Mock DataClient interface with testing utilities.
 */
export interface MockDataClient {
	/** Mock fetch function - returns configured response or error */
	fetch: ReturnType<typeof vi.fn>;
	/** Mock invalidate function */
	invalidate: ReturnType<typeof vi.fn>;
	/** Mock invalidateByPrefix function */
	invalidateByPrefix: ReturnType<typeof vi.fn>;
	/** Mock getKeyConfig function */
	getKeyConfig: ReturnType<typeof vi.fn>;
	/** Mock getEvents function */
	getEvents: ReturnType<typeof vi.fn>;
	/** Mock getBaseUrl function */
	getBaseUrl: ReturnType<typeof vi.fn>;
	/** Mock setCache function */
	setCache: ReturnType<typeof vi.fn>;
	/** Mock setEvents function */
	setEvents: ReturnType<typeof vi.fn>;
	/** Mock mutate function */
	mutate: ReturnType<typeof vi.fn>;

	/**
	 * Configure a response for a data key.
	 * Next fetch() for this key will return this data.
	 */
	setResponse<K extends DataKey>(key: K, data: DataType<K>): void;

	/**
	 * Configure an error for a data key.
	 * Next fetch() for this key will throw this error.
	 */
	setError(key: DataKey, error: Error): void;

	/**
	 * Clear a configured response or error for a key.
	 */
	clearResponse(key: DataKey): void;

	/**
	 * Get all fetch calls made to this mock.
	 */
	getFetchCalls(): Array<{ key: DataKey; params?: Record<string, string> }>;

	/**
	 * Clear all recorded fetch calls.
	 */
	clearFetchCalls(): void;

	/**
	 * Reset all responses, errors, and fetch calls.
	 */
	reset(): void;
}

/**
 * Creates a mock DataClient for testing.
 *
 * Unlike the real DataClient, this mock doesn't make network requests.
 * Configure responses with setResponse() and setError(), then verify
 * interactions with getFetchCalls().
 *
 * @param options - Optional configuration
 * @returns MockDataClient instance
 *
 * @example
 * ```typescript
 * import { createMockDataClient } from '@warpkit/core/testing';
 *
 * describe('MyComponent', () => {
 *   it('should display fetched data', async () => {
 *     const mockClient = createMockDataClient();
 *     mockClient.setResponse('monitors', [{ id: '1', name: 'Test' }]);
 *
 *     // Render component with mockClient...
 *
 *     // Verify fetch was called
 *     expect(mockClient.getFetchCalls()).toEqual([
 *       { key: 'monitors', params: undefined }
 *     ]);
 *   });
 * });
 * ```
 */
export function createMockDataClient(options: MockDataClientOptions = {}): MockDataClient {
	const responses = new Map<string, unknown>();
	const errors = new Map<string, Error>();
	const fetchCalls: Array<{ key: DataKey; params?: Record<string, string> }> = [];

	const mockClient: MockDataClient = {
		fetch: vi.fn(
			async <K extends DataKey>(
				key: K,
				params?: Record<string, string>
			): Promise<FetchResult<DataType<K>>> => {
				fetchCalls.push({ key, params });

				const error = errors.get(key);
				if (error) {
					throw error;
				}

				const data = responses.get(key) as DataType<K> | undefined;
				return {
					data: data as DataType<K>,
					fromCache: false,
					notModified: false
				};
			}
		),

		invalidate: vi.fn(async (_key: DataKey, _params?: Record<string, string>): Promise<void> => {
			// No-op for mock
		}),

		invalidateByPrefix: vi.fn(async (_prefix: string): Promise<void> => {
			// No-op for mock
		}),

		getKeyConfig: vi.fn(<K extends DataKey>(key: K): DataKeyConfig<K> | undefined => {
			return options.keyConfigs?.get(key) as DataKeyConfig<K> | undefined;
		}),

		getEvents: vi.fn((): DataEventEmitter | null => {
			return options.events ?? null;
		}),

		getBaseUrl: vi.fn((): string => {
			return '';
		}),

		setCache: vi.fn(),
		setEvents: vi.fn(),

		mutate: vi.fn(async <T>(_url: string, _options: { method: string; body?: unknown }): Promise<T> => {
			return {} as T;
		}),

		setResponse<K extends DataKey>(key: K, data: DataType<K>): void {
			responses.set(key, data);
			errors.delete(key); // Clear any error for this key
		},

		setError(key: DataKey, error: Error): void {
			errors.set(key, error);
			responses.delete(key); // Clear any response for this key
		},

		clearResponse(key: DataKey): void {
			responses.delete(key);
			errors.delete(key);
		},

		getFetchCalls(): Array<{ key: DataKey; params?: Record<string, string> }> {
			return [...fetchCalls];
		},

		clearFetchCalls(): void {
			fetchCalls.length = 0;
		},

		reset(): void {
			responses.clear();
			errors.clear();
			fetchCalls.length = 0;
			mockClient.fetch.mockClear();
			mockClient.invalidate.mockClear();
			mockClient.invalidateByPrefix.mockClear();
			mockClient.getKeyConfig.mockClear();
			mockClient.getEvents.mockClear();
			mockClient.getBaseUrl.mockClear();
			mockClient.setCache.mockClear();
			mockClient.setEvents.mockClear();
			mockClient.mutate.mockClear();
		}
	};

	return mockClient;
}

// Backwards compatibility
/**
 * @deprecated Use createMockDataClient instead
 */
export const createMockQueryClient = createMockDataClient;

/**
 * @deprecated Use MockDataClient instead
 */
export type MockQueryClient = MockDataClient;

/**
 * @deprecated Use MockDataClientOptions instead
 */
export type MockQueryClientOptions = MockDataClientOptions;
