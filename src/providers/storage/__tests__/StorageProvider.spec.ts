/**
 * StorageProvider Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { DefaultStorageProvider } from '../StorageProvider';

describe('DefaultStorageProvider', () => {
	let provider: DefaultStorageProvider;
	let mockStorage: Map<string, string>;

	beforeEach(() => {
		provider = new DefaultStorageProvider();

		// Mock sessionStorage
		mockStorage = new Map();
		const storageMock = {
			getItem: (key: string) => mockStorage.get(key) ?? null,
			setItem: (key: string, value: string) => mockStorage.set(key, value),
			removeItem: (key: string) => mockStorage.delete(key),
			clear: () => mockStorage.clear(),
			length: 0,
			key: () => null
		};

		// @ts-expect-error - mocking global
		globalThis.window = { sessionStorage: storageMock };
		globalThis.sessionStorage = storageMock;
	});

	afterEach(() => {
		// @ts-expect-error - cleaning up mock
		delete globalThis.window;
		// @ts-expect-error - cleaning up mock
		delete globalThis.sessionStorage;
	});

	describe('id', () => {
		it('should have id of storage', () => {
			expect(provider.id).toBe('storage');
		});
	});

	describe('scroll positions', () => {
		it('should save and retrieve scroll position', () => {
			provider.saveScrollPosition(1, { x: 0, y: 100 });
			const position = provider.getScrollPosition(1);

			expect(position).toEqual({ x: 0, y: 100 });
		});

		it('should return null for unknown navigation ID', () => {
			const position = provider.getScrollPosition(999);
			expect(position).toBeNull();
		});

		it('should overwrite existing position', () => {
			provider.saveScrollPosition(1, { x: 0, y: 100 });
			provider.saveScrollPosition(1, { x: 0, y: 200 });

			const position = provider.getScrollPosition(1);
			expect(position).toEqual({ x: 0, y: 200 });
		});

		it('should store multiple positions', () => {
			provider.saveScrollPosition(1, { x: 0, y: 100 });
			provider.saveScrollPosition(2, { x: 0, y: 200 });
			provider.saveScrollPosition(3, { x: 0, y: 300 });

			expect(provider.getScrollPosition(1)).toEqual({ x: 0, y: 100 });
			expect(provider.getScrollPosition(2)).toEqual({ x: 0, y: 200 });
			expect(provider.getScrollPosition(3)).toEqual({ x: 0, y: 300 });
		});

		describe('LRU eviction', () => {
			it('should evict oldest entries when over limit', () => {
				provider = new DefaultStorageProvider({ maxScrollPositions: 3 });

				// Add 4 entries
				provider.saveScrollPosition(1, { x: 0, y: 100 });
				provider.saveScrollPosition(2, { x: 0, y: 200 });
				provider.saveScrollPosition(3, { x: 0, y: 300 });
				provider.saveScrollPosition(4, { x: 0, y: 400 });

				// Entry 1 should be evicted
				expect(provider.getScrollPosition(1)).toBeNull();
				expect(provider.getScrollPosition(2)).toEqual({ x: 0, y: 200 });
				expect(provider.getScrollPosition(3)).toEqual({ x: 0, y: 300 });
				expect(provider.getScrollPosition(4)).toEqual({ x: 0, y: 400 });
			});
		});
	});

	describe('intended path', () => {
		it('should save and pop intended path', () => {
			provider.saveIntendedPath('/dashboard');
			const path = provider.popIntendedPath();

			expect(path).toBe('/dashboard');
		});

		it('should clear intended path after pop', () => {
			provider.saveIntendedPath('/dashboard');
			provider.popIntendedPath();
			const path = provider.popIntendedPath();

			expect(path).toBeNull();
		});

		it('should return null when no intended path', () => {
			const path = provider.popIntendedPath();
			expect(path).toBeNull();
		});

		it('should overwrite existing intended path', () => {
			provider.saveIntendedPath('/first');
			provider.saveIntendedPath('/second');
			const path = provider.popIntendedPath();

			expect(path).toBe('/second');
		});
	});

	describe('graceful degradation', () => {
		it('should handle missing sessionStorage for scroll positions', () => {
			// @ts-expect-error - mocking missing storage
			delete globalThis.sessionStorage;
			// @ts-expect-error - mocking missing window
			delete globalThis.window;

			// Should not throw
			provider.saveScrollPosition(1, { x: 0, y: 100 });
			const position = provider.getScrollPosition(1);

			expect(position).toBeNull();
		});

		it('should handle missing sessionStorage for intended path', () => {
			// @ts-expect-error - mocking missing storage
			delete globalThis.sessionStorage;
			// @ts-expect-error - mocking missing window
			delete globalThis.window;

			// Should not throw
			provider.saveIntendedPath('/test');
			const path = provider.popIntendedPath();

			expect(path).toBeNull();
		});
	});
});
