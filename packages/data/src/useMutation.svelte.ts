/**
 * @warpkit/data useMutation Hook
 *
 * Standalone mutation hook for Svelte 5.
 * Use for mutations that don't belong to a specific data key.
 */

import type { MutationState, UseMutationOptions } from './types';

/**
 * Standalone mutation hook for Svelte 5.
 *
 * Use for mutations that don't belong to a specific data key,
 * such as auth operations, form submissions, etc.
 *
 * @param options - Mutation options including the mutation function and callbacks
 * @returns Mutation state with execute functions and status
 *
 * @example
 * const login = useMutation({
 *   mutationFn: async (credentials) => {
 *     const response = await fetch('/api/login', {
 *       method: 'POST',
 *       body: JSON.stringify(credentials)
 *     });
 *     return response.json();
 *   },
 *   onSuccess: (data) => {
 *     // Handle successful login
 *   },
 *   onError: (error) => {
 *     // Handle error
 *   }
 * });
 *
 * // Execute mutation
 * await login.mutate({ email: 'user@example.com', password: 'secret' });
 *
 * // Check state
 * login.isPending    // boolean
 * login.isSuccess    // boolean
 * login.isError      // boolean
 * login.error        // Error | null
 * login.data         // TData | undefined
 */
export function useMutation<TData, TError = Error, TVariables = void>(
	options: UseMutationOptions<TData, TError, TVariables>
): MutationState<TData, TError, TVariables> {
	// State
	let data = $state<TData | undefined>(undefined);
	let error = $state<TError | null>(null);
	let isPending = $state<boolean>(false);
	let status = $state<'idle' | 'pending' | 'success' | 'error'>('idle');

	// Derived state
	const isSuccess = $derived(status === 'success');
	const isError = $derived(status === 'error');
	const isIdle = $derived(status === 'idle');

	/**
	 * Execute the mutation.
	 */
	async function mutate(variables: TVariables): Promise<TData> {
		isPending = true;
		status = 'pending';
		error = null;

		try {
			const result = await options.mutationFn(variables);
			data = result;
			status = 'success';

			// Call onSuccess callback
			if (options.onSuccess) {
				await options.onSuccess(result, variables);
			}

			// Call onSettled callback
			if (options.onSettled) {
				await options.onSettled(result, null, variables);
			}

			return result;
		} catch (e) {
			const thrownError = e as TError;
			error = thrownError;
			status = 'error';

			// Call onError callback
			if (options.onError) {
				await options.onError(thrownError, variables);
			}

			// Call onSettled callback
			if (options.onSettled) {
				await options.onSettled(undefined, thrownError, variables);
			}

			throw e;
		} finally {
			isPending = false;
		}
	}

	/**
	 * Reset mutation state to idle.
	 */
	function reset(): void {
		data = undefined;
		error = null;
		isPending = false;
		status = 'idle';
	}

	// Return state object with getters for reactivity
	return {
		mutate,
		mutateAsync: mutate,
		get isPending() {
			return isPending;
		},
		get isSuccess() {
			return isSuccess;
		},
		get isError() {
			return isError;
		},
		get isIdle() {
			return isIdle;
		},
		get error() {
			return error;
		},
		get data() {
			return data;
		},
		reset
	};
}
