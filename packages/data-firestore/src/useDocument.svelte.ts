import { onSnapshot, type DocumentReference, type DocumentData } from 'firebase/firestore';
import { reportError } from '@warpkit/errors';
import { snapshotToData } from './utils';
import type { UseDocumentOptions, UseDocumentResult } from './types';

/**
 * Reactive Firestore document subscription using Svelte 5 runes.
 *
 * Subscribes to a Firestore document reference and provides reactive data, loading, error, and exists state.
 * Automatically resubscribes when the ref function returns a different reference.
 * Cleans up the listener when the component is destroyed or the ref changes.
 *
 * @param refFn - Function returning a Firestore DocumentReference or null (null = no subscription)
 * @param options - Optional configuration for ID field injection and data transformation
 * @returns Reactive document state
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useDocument } from '@warpkit/data-firestore';
 *   import { doc } from 'firebase/firestore';
 *
 *   const user = useDocument<UserProfile>(
 *     () => doc(db, 'users', userId)
 *   );
 * </script>
 *
 * {#if user.loading}
 *   <p>Loading...</p>
 * {:else if user.data}
 *   <p>{user.data.displayName}</p>
 * {/if}
 * ```
 */
export function useDocument<T = DocumentData>(
	refFn: () => DocumentReference | null,
	options?: UseDocumentOptions<T>
): UseDocumentResult<T> {
	const idField = options?.idField ?? 'id';
	const transform = options?.transform;

	let data = $state<T | null>(null);
	let loading = $state(true);
	let error = $state<Error | null>(null);
	let exists = $state(false);

	$effect(() => {
		const ref = refFn();

		if (!ref) {
			data = null;
			loading = false;
			error = null;
			exists = false;
			return;
		}

		loading = true;
		error = null;

		const unsubscribe = onSnapshot(
			ref,
			(snapshot) => {
				exists = snapshot.exists();

				if (exists) {
					if (transform) {
						data = transform(snapshot.data()!);
					} else {
						data = snapshotToData<T>(snapshot, idField);
					}
				} else {
					data = null;
				}

				loading = false;
				error = null;
			},
			(err) => {
				error = err;
				loading = false;
				reportError('firestore', err, {
					severity: 'error',
					handledLocally: true,
					context: { hook: 'useDocument' },
				});
			}
		);

		return () => {
			unsubscribe();
		};
	});

	return {
		get data() {
			return data;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get exists() {
			return exists;
		},
	};
}
