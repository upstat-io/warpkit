/**
 * MockConfirmProvider Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockConfirmProvider } from '../MockConfirmProvider';

describe('MockConfirmProvider', () => {
	let provider: MockConfirmProvider;

	beforeEach(() => {
		provider = new MockConfirmProvider();
	});

	describe('id', () => {
		it('should have id of confirmDialog', () => {
			expect(provider.id).toBe('confirmDialog');
		});
	});

	describe('confirm', () => {
		it('should return true by default (alwaysConfirm: true)', async () => {
			const result = await provider.confirm('Leave page?');
			expect(result).toBe(true);
		});

		it('should return false when constructed with alwaysConfirm: false', async () => {
			const falseProvider = new MockConfirmProvider({ alwaysConfirm: false });
			const result = await falseProvider.confirm('Leave page?');
			expect(result).toBe(false);
		});

		it('should track confirm calls in confirmCalls array', async () => {
			await provider.confirm('Message 1');
			await provider.confirm('Message 2');
			await provider.confirm('Message 3');

			expect(provider.confirmCalls).toEqual(['Message 1', 'Message 2', 'Message 3']);
		});

		it('should return overridden result from setNextResult', async () => {
			provider.setNextResult(false);
			const result = await provider.confirm('Leave page?');
			expect(result).toBe(false);
		});

		it('should consume override after one use', async () => {
			provider.setNextResult(false);

			const first = await provider.confirm('First');
			const second = await provider.confirm('Second');

			expect(first).toBe(false);
			expect(second).toBe(true); // Back to default
		});

		it('should use latest override when set multiple times', async () => {
			provider.setNextResult(false);
			provider.setNextResult(true);

			const result = await provider.confirm('Message');
			expect(result).toBe(true);
		});
	});

	describe('setDefaultResult', () => {
		it('should change default result for all future calls', async () => {
			provider.setDefaultResult(false);

			const first = await provider.confirm('First');
			const second = await provider.confirm('Second');

			expect(first).toBe(false);
			expect(second).toBe(false);
		});

		it('should be overridden by setNextResult for one call', async () => {
			provider.setDefaultResult(false);
			provider.setNextResult(true);

			const first = await provider.confirm('First');
			const second = await provider.confirm('Second');

			expect(first).toBe(true); // Override
			expect(second).toBe(false); // Back to new default
		});
	});

	describe('clearHistory', () => {
		it('should clear confirmCalls array', async () => {
			await provider.confirm('Message 1');
			await provider.confirm('Message 2');

			provider.clearHistory();

			expect(provider.confirmCalls).toEqual([]);
		});

		it('should not affect future calls', async () => {
			await provider.confirm('Before');
			provider.clearHistory();
			await provider.confirm('After');

			expect(provider.confirmCalls).toEqual(['After']);
		});
	});
});
