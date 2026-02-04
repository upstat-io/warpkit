/**
 * ConfirmDialogProvider Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { DefaultConfirmDialogProvider } from '../ConfirmDialogProvider';

describe('DefaultConfirmDialogProvider', () => {
	let provider: DefaultConfirmDialogProvider;
	let originalWindow: typeof globalThis.window;

	beforeEach(() => {
		provider = new DefaultConfirmDialogProvider();
		originalWindow = globalThis.window;
	});

	afterEach(() => {
		globalThis.window = originalWindow;
	});

	describe('id', () => {
		it('should have id of confirmDialog', () => {
			expect(provider.id).toBe('confirmDialog');
		});
	});

	describe('confirm', () => {
		it('should return true when user confirms', async () => {
			// @ts-expect-error - mocking window.confirm
			globalThis.window = { confirm: mock(() => true) };

			const result = await provider.confirm('Leave page?');
			expect(result).toBe(true);
		});

		it('should return false when user cancels', async () => {
			// @ts-expect-error - mocking window.confirm
			globalThis.window = { confirm: mock(() => false) };

			const result = await provider.confirm('Leave page?');
			expect(result).toBe(false);
		});

		it('should pass message to window.confirm', async () => {
			const confirmMock = mock(() => true);
			// @ts-expect-error - mocking window.confirm
			globalThis.window = { confirm: confirmMock };

			await provider.confirm('Are you sure?');

			expect(confirmMock).toHaveBeenCalledWith('Are you sure?');
		});

		it('should return true when window is undefined', async () => {
			// @ts-expect-error - simulating SSR
			globalThis.window = undefined;

			const result = await provider.confirm('Leave page?');
			expect(result).toBe(true);
		});

		it('should return true when window.confirm is not a function', async () => {
			// @ts-expect-error - mocking window without confirm
			globalThis.window = { confirm: 'not a function' };

			const result = await provider.confirm('Leave page?');
			expect(result).toBe(true);
		});
	});
});
