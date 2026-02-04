/**
 * WarpKit v2 Context Tests
 *
 * Tests for the context symbol and context types.
 */
import { describe, it, expect } from 'bun:test';
import { WARPKIT_CONTEXT } from '../context';
import type { WarpKitContext, WarpKit } from '../context';
import type { SvelteURLSearchParams } from '../core/SvelteURLSearchParams.svelte';

/**
 * Create a mock SvelteURLSearchParams for testing.
 * Real SvelteURLSearchParams uses Svelte 5 runes which aren't available in Bun tests.
 */
function createMockSearchParams(): SvelteURLSearchParams {
	const params = new URLSearchParams();
	return {
		get: (key: string) => params.get(key),
		getAll: (key: string) => params.getAll(key),
		has: (key: string) => params.has(key),
		set: (key: string, value: string) => params.set(key, value),
		delete: (key: string) => params.delete(key),
		append: (key: string, value: string) => params.append(key, value),
		forEach: (callback: (value: string, key: string) => void) => params.forEach(callback),
		toString: () => params.toString(),
		replaceAll: () => {},
		keys: () => params.keys(),
		values: () => params.values(),
		entries: () => params.entries(),
		[Symbol.iterator]: () => params[Symbol.iterator](),
		size: 0
	} as unknown as SvelteURLSearchParams;
}

describe('WarpKit v2 Context', () => {
	describe('WARPKIT_CONTEXT symbol', () => {
		it('should be a unique symbol', () => {
			expect(typeof WARPKIT_CONTEXT).toBe('symbol');
		});

		it('should have descriptive string representation', () => {
			expect(WARPKIT_CONTEXT.toString()).toBe('Symbol(warpkit-v2)');
		});

		it('should not equal any other symbol', () => {
			const otherSymbol = Symbol('warpkit-v2');
			expect(WARPKIT_CONTEXT).not.toBe(otherSymbol);
		});

		it('should be usable as object key', () => {
			const obj: Record<symbol, string> = {};
			obj[WARPKIT_CONTEXT] = 'test';
			expect(obj[WARPKIT_CONTEXT]).toBe('test');
		});
	});

	describe('WarpKitContext interface', () => {
		it('should have required properties', () => {
			// This is a type-level test - if it compiles, the interface is correct
			const mockContext: WarpKitContext = {
				warpkit: {} as WarpKit,
				page: {
					path: '/',
					pathname: '/',
					search: createMockSearchParams(),
					hash: '',
					params: {},
					route: null,
					error: null,
					isNavigating: false,
					appState: 'test',
					update: () => {},
					setNavigating: () => {},
					setError: () => {},
					clearError: () => {}
				},
				routeComponent: null,
				layoutComponent: null,
				stateId: 0,
				retryLoad: () => {}
			};

			expect(mockContext.warpkit).toBeDefined();
			expect(mockContext.page).toBeDefined();
			expect(mockContext.routeComponent).toBeNull();
			expect(mockContext.layoutComponent).toBeNull();
			expect(mockContext.stateId).toBe(0);
			expect(typeof mockContext.retryLoad).toBe('function');
		});
	});

	describe('WarpKit interface', () => {
		it('should define navigation methods', () => {
			// Type-level test - mock implementation to verify interface shape
			const mockWarpKit: WarpKit<'test'> = {
				page: {} as never,
				events: {} as never,
				ready: true,
				navigate: async () => ({ success: true }),
				setState: async () => {},
				buildUrl: (path) => path,
				registerBlocker: () => ({ unregister: () => {} }),
				getState: () => 'test',
				getStateId: () => 0,
				start: async () => {},
				destroy: () => {}
			};

			expect(typeof mockWarpKit.navigate).toBe('function');
			expect(typeof mockWarpKit.setState).toBe('function');
			expect(typeof mockWarpKit.buildUrl).toBe('function');
			expect(typeof mockWarpKit.registerBlocker).toBe('function');
			expect(typeof mockWarpKit.getState).toBe('function');
			expect(typeof mockWarpKit.getStateId).toBe('function');
			expect(typeof mockWarpKit.start).toBe('function');
			expect(typeof mockWarpKit.destroy).toBe('function');
		});
	});
});
