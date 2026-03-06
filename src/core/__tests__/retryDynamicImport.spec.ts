import { describe, it, expect, vi } from 'vitest';
import { retryDynamicImport } from '../retryDynamicImport.js';

describe('retryDynamicImport', () => {
	it('should succeed on first try without retrying', async () => {
		const loader = vi.fn().mockResolvedValue({ default: 'component' });

		const result = await retryDynamicImport(loader);

		expect(result).toEqual({ default: 'component' });
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it('should retry on transient fetch error and succeed', async () => {
		const fetchError = new TypeError('Failed to fetch dynamically imported module: /src/App.svelte');
		const loader = vi
			.fn()
			.mockRejectedValueOnce(fetchError)
			.mockResolvedValue({ default: 'component' });

		const result = await retryDynamicImport(loader);

		expect(result).toEqual({ default: 'component' });
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it('should retry twice then succeed on third attempt', async () => {
		const fetchError = new TypeError('Failed to fetch dynamically imported module: /src/App.svelte');
		const loader = vi
			.fn()
			.mockRejectedValueOnce(fetchError)
			.mockRejectedValueOnce(fetchError)
			.mockResolvedValue({ default: 'component' });

		const result = await retryDynamicImport(loader);

		expect(result).toEqual({ default: 'component' });
		expect(loader).toHaveBeenCalledTimes(3);
	});

	it('should throw the original error after all retries exhausted', async () => {
		const fetchError = new TypeError('Failed to fetch dynamically imported module: /src/App.svelte');
		const loader = vi.fn().mockRejectedValue(fetchError);

		await expect(retryDynamicImport(loader)).rejects.toBe(fetchError);
		expect(loader).toHaveBeenCalledTimes(3);
	});

	it('should NOT retry on SyntaxError (module evaluation error)', async () => {
		const syntaxError = new SyntaxError('Unexpected token');
		const loader = vi.fn().mockRejectedValue(syntaxError);

		await expect(retryDynamicImport(loader)).rejects.toBe(syntaxError);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it('should NOT retry on ReferenceError', async () => {
		const refError = new ReferenceError('x is not defined');
		const loader = vi.fn().mockRejectedValue(refError);

		await expect(retryDynamicImport(loader)).rejects.toBe(refError);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it('should NOT retry on RangeError', async () => {
		const rangeError = new RangeError('Maximum call stack size exceeded');
		const loader = vi.fn().mockRejectedValue(rangeError);

		await expect(retryDynamicImport(loader)).rejects.toBe(rangeError);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it('should retry on TypeError with "fetch" in message', async () => {
		const error = new TypeError('fetch failed');
		const loader = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValue({ default: 'component' });

		const result = await retryDynamicImport(loader);

		expect(result).toEqual({ default: 'component' });
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it('should retry on "Load failed" error (Safari)', async () => {
		const error = new TypeError('Load failed');
		const loader = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValue({ default: 'component' });

		const result = await retryDynamicImport(loader);

		expect(result).toEqual({ default: 'component' });
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it('should preserve error identity (not wrap the error)', async () => {
		const originalError = new TypeError(
			'Failed to fetch dynamically imported module: /src/Foo.svelte'
		);
		const loader = vi.fn().mockRejectedValue(originalError);

		try {
			await retryDynamicImport(loader);
			expect.unreachable('should have thrown');
		} catch (err) {
			// Strict identity check — same object, not a copy or wrapper
			expect(err).toBe(originalError);
			expect(err).toBeInstanceOf(TypeError);
			expect((err as Error).message).toBe(
				'Failed to fetch dynamically imported module: /src/Foo.svelte'
			);
		}
	});

	it('should NOT retry on TypeError without fetch/load/import keywords', async () => {
		const error = new TypeError("Cannot read properties of undefined (reading 'foo')");
		const loader = vi.fn().mockRejectedValue(error);

		await expect(retryDynamicImport(loader)).rejects.toBe(error);
		expect(loader).toHaveBeenCalledTimes(1);
	});
});
