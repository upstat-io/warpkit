/**
 * resolveProviders Unit Tests
 */
import { describe, it, expect, vi } from 'vitest';
import {
	resolveProviders,
	CircularDependencyError,
	MissingProviderError,
	ProviderKeyMismatchError
} from '../resolveProviders';
import type { Provider, WarpKitCore } from '../../providers/interfaces';
import type { PageState } from '../types';
import { MemoryBrowserProvider } from '../../providers/browser/MemoryBrowserProvider';

function createMockWarpKitCore(): WarpKitCore {
	return {
		page: {} as PageState,
		getState: () => 'test',
		getStateId: () => 0,
		onNavigationComplete: () => () => {}
	};
}

// Use MemoryBrowserProvider in all tests since DefaultBrowserProvider requires browser APIs
function createTestRegistry() {
	return {
		browser: new MemoryBrowserProvider()
	};
}

describe('resolveProviders', () => {
	describe('default providers', () => {
		it('should provide browser provider from registry', async () => {
			const warpkit = createMockWarpKitCore();
			const resolved = await resolveProviders(createTestRegistry(), warpkit);

			expect(resolved.browser).toBeDefined();
			expect(resolved.browser.id).toBe('browser');
		});

		it('should provide default confirmDialog provider', async () => {
			const warpkit = createMockWarpKitCore();
			const resolved = await resolveProviders(createTestRegistry(), warpkit);

			expect(resolved.confirmDialog).toBeDefined();
			expect(resolved.confirmDialog.id).toBe('confirmDialog');
		});

		it('should provide default storage provider', async () => {
			const warpkit = createMockWarpKitCore();
			const resolved = await resolveProviders(createTestRegistry(), warpkit);

			expect(resolved.storage).toBeDefined();
			expect(resolved.storage.id).toBe('storage');
		});
	});

	describe('custom providers', () => {
		it('should use custom provider when provided', async () => {
			const customConfirm = {
				id: 'confirmDialog' as const,
				confirm: async () => false
			};

			const warpkit = createMockWarpKitCore();
			const resolved = await resolveProviders(
				{ ...createTestRegistry(), confirmDialog: customConfirm },
				warpkit
			);

			expect(resolved.confirmDialog).toBe(customConfirm);
		});

		it('should include custom providers in resolved', async () => {
			const customProvider: Provider = {
				id: 'analytics'
			};

			const warpkit = createMockWarpKitCore();
			const resolved = await resolveProviders(
				{ ...createTestRegistry(), analytics: customProvider },
				warpkit
			);

			expect(resolved['analytics']).toBe(customProvider);
		});
	});

	describe('initialization', () => {
		it('should call initialize on providers', async () => {
			const initFn = vi.fn(() => {});
			const provider: Provider = {
				id: 'test',
				initialize: initFn
			};

			const warpkit = createMockWarpKitCore();
			await resolveProviders({ ...createTestRegistry(), test: provider }, warpkit);

			expect(initFn).toHaveBeenCalledTimes(1);
			expect(initFn).toHaveBeenCalledWith(warpkit);
		});

		it('should await async initialize', async () => {
			let initialized = false;
			const provider: Provider = {
				id: 'test',
				initialize: async () => {
					await new Promise((r) => setTimeout(r, 10));
					initialized = true;
				}
			};

			const warpkit = createMockWarpKitCore();
			await resolveProviders({ ...createTestRegistry(), test: provider }, warpkit);

			expect(initialized).toBe(true);
		});
	});

	describe('dependency ordering', () => {
		it('should initialize dependencies before dependents', async () => {
			const order: string[] = [];

			const providerA: Provider = {
				id: 'a',
				initialize: () => {
					order.push('a');
				}
			};

			const providerB: Provider = {
				id: 'b',
				dependsOn: ['a'],
				initialize: () => {
					order.push('b');
				}
			};

			const warpkit = createMockWarpKitCore();
			await resolveProviders({ ...createTestRegistry(), a: providerA, b: providerB }, warpkit);

			expect(order).toEqual(['a', 'b']);
		});

		it('should handle diamond dependency', async () => {
			const order: string[] = [];

			const providerA: Provider = {
				id: 'a',
				initialize: () => {
					order.push('a');
				}
			};

			const providerB: Provider = {
				id: 'b',
				dependsOn: ['a'],
				initialize: () => {
					order.push('b');
				}
			};

			const providerC: Provider = {
				id: 'c',
				dependsOn: ['a'],
				initialize: () => {
					order.push('c');
				}
			};

			const providerD: Provider = {
				id: 'd',
				dependsOn: ['b', 'c'],
				initialize: () => {
					order.push('d');
				}
			};

			const warpkit = createMockWarpKitCore();
			await resolveProviders(
				{ ...createTestRegistry(), a: providerA, b: providerB, c: providerC, d: providerD },
				warpkit
			);

			// A must come first, D must come last
			expect(order[0]).toBe('a');
			expect(order[order.length - 1]).toBe('d');
			// B and C must come after A but before D
			expect(order.indexOf('b')).toBeGreaterThan(order.indexOf('a'));
			expect(order.indexOf('c')).toBeGreaterThan(order.indexOf('a'));
			expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
			expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
		});
	});

	describe('validation', () => {
		it('should throw CircularDependencyError for circular deps', async () => {
			const providerA: Provider = {
				id: 'a',
				dependsOn: ['b']
			};

			const providerB: Provider = {
				id: 'b',
				dependsOn: ['a']
			};

			const warpkit = createMockWarpKitCore();

			await expect(
				resolveProviders({ ...createTestRegistry(), a: providerA, b: providerB }, warpkit)
			).rejects.toThrow(CircularDependencyError);
		});

		it('should throw MissingProviderError for missing dependency', async () => {
			const provider: Provider = {
				id: 'test',
				dependsOn: ['nonexistent']
			};

			const warpkit = createMockWarpKitCore();

			await expect(resolveProviders({ ...createTestRegistry(), test: provider }, warpkit)).rejects.toThrow(
				MissingProviderError
			);
		});

		it('should throw ProviderKeyMismatchError when key != id', async () => {
			const provider: Provider = {
				id: 'actualId'
			};

			const warpkit = createMockWarpKitCore();

			await expect(
				resolveProviders({ ...createTestRegistry(), wrongKey: provider }, warpkit)
			).rejects.toThrow(ProviderKeyMismatchError);
		});
	});

	describe('error propagation', () => {
		it('should propagate initialize errors', async () => {
			const provider: Provider = {
				id: 'test',
				initialize: () => {
					throw new Error('Init failed');
				}
			};

			const warpkit = createMockWarpKitCore();

			await expect(resolveProviders({ ...createTestRegistry(), test: provider }, warpkit)).rejects.toThrow(
				'Init failed'
			);
		});
	});
});
