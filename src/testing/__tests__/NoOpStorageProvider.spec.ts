/**
 * NoOpStorageProvider Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { NoOpStorageProvider } from '../NoOpStorageProvider';

describe('NoOpStorageProvider', () => {
	describe('id', () => {
		it('should have id of storage', () => {
			const provider = new NoOpStorageProvider();
			expect(provider.id).toBe('storage');
		});
	});

	describe('saveScrollPosition', () => {
		it('should not throw when called', () => {
			const provider = new NoOpStorageProvider();
			expect(() => provider.saveScrollPosition(1, { x: 0, y: 100 })).not.toThrow();
		});

		it('should accept any navigation ID', () => {
			const provider = new NoOpStorageProvider();
			expect(() => provider.saveScrollPosition(0, { x: 0, y: 0 })).not.toThrow();
			expect(() => provider.saveScrollPosition(-1, { x: 0, y: 0 })).not.toThrow();
			expect(() => provider.saveScrollPosition(999999, { x: 0, y: 0 })).not.toThrow();
		});
	});

	describe('getScrollPosition', () => {
		it('should always return null', () => {
			const provider = new NoOpStorageProvider();

			// Even after saving
			provider.saveScrollPosition(1, { x: 0, y: 100 });

			expect(provider.getScrollPosition(1)).toBeNull();
			expect(provider.getScrollPosition(2)).toBeNull();
			expect(provider.getScrollPosition(0)).toBeNull();
		});
	});

	describe('saveIntendedPath', () => {
		it('should not throw when called', () => {
			const provider = new NoOpStorageProvider();
			expect(() => provider.saveIntendedPath('/dashboard')).not.toThrow();
		});

		it('should accept any path', () => {
			const provider = new NoOpStorageProvider();
			expect(() => provider.saveIntendedPath('')).not.toThrow();
			expect(() => provider.saveIntendedPath('/a/b/c')).not.toThrow();
			expect(() => provider.saveIntendedPath('/path?query=1#hash')).not.toThrow();
		});
	});

	describe('popIntendedPath', () => {
		it('should always return null', () => {
			const provider = new NoOpStorageProvider();

			// Even after saving
			provider.saveIntendedPath('/dashboard');

			expect(provider.popIntendedPath()).toBeNull();
		});

		it('should return null on repeated calls', () => {
			const provider = new NoOpStorageProvider();

			expect(provider.popIntendedPath()).toBeNull();
			expect(provider.popIntendedPath()).toBeNull();
			expect(provider.popIntendedPath()).toBeNull();
		});
	});
});
