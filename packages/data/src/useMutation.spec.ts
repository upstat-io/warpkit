import { describe, expect, it } from 'vitest';
import { useMutation } from './useMutation.svelte.js';

/**
 * `mutate` vs `mutateAsync` error contract.
 *
 * `mutate` is the fire-and-forget entry point: callers write it in void event
 * handlers, so a rejection there lands in no catch and becomes an unhandled
 * rejection — which the framework's own global handler then surfaces, despite
 * `mutate` having already reported the failure as handled-locally. `mutateAsync`
 * is the entry point for callers that want to branch on the outcome.
 */
describe('useMutation error contract', () => {
	function failing(err: Error, onError?: (e: Error) => void) {
		return useMutation<string, Error, void>({
			mutationFn: () => Promise.reject(err),
			...(onError ? { onError } : {})
		});
	}

	it('should resolve to undefined rather than reject when mutate fails', async () => {
		const boom = new Error('HTTP 422: Unprocessable Entity');
		const mutation = failing(boom);

		// Must not throw — this is the whole point of the fire-and-forget entry point.
		const result = await mutation.mutate();

		expect(result).toBeUndefined();
		expect(mutation.isError).toBe(true);
		expect(mutation.error).toBe(boom);
	});

	it('should reject when mutateAsync fails so the caller can branch', async () => {
		const boom = new Error('HTTP 422: Unprocessable Entity');
		const mutation = failing(boom);

		await expect(mutation.mutateAsync()).rejects.toThrow('HTTP 422');
		expect(mutation.isError).toBe(true);
	});

	it('should still invoke onError before mutate swallows the failure', async () => {
		const boom = new Error('nope');
		const seen: Error[] = [];
		const mutation = failing(boom, (e) => seen.push(e));

		await mutation.mutate();

		expect(seen).toEqual([boom]);
	});

	it('should return the value from both entry points when the mutation succeeds', async () => {
		const mutation = useMutation<string, Error, void>({
			mutationFn: () => Promise.resolve('ok')
		});

		expect(await mutation.mutate()).toBe('ok');
		expect(await mutation.mutateAsync()).toBe('ok');
		expect(mutation.isSuccess).toBe(true);
	});

	// Negative pin: mutate must not mask a success-path throw from onSuccess by
	// reporting it as a plain undefined — the mutation itself did fail to complete
	// its declared work, and mutateAsync must still surface it.
	it('should report an onSuccess failure through mutateAsync', async () => {
		const boom = new Error('onSuccess exploded');
		const mutation = useMutation<string, Error, void>({
			mutationFn: () => Promise.resolve('ok'),
			onSuccess: () => {
				throw boom;
			}
		});

		await expect(mutation.mutateAsync()).rejects.toThrow('onSuccess exploded');
	});
});
