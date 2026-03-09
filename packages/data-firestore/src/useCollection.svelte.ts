import { onSnapshot, type Query, type DocumentData } from 'firebase/firestore';
import { reportError } from '@warpkit/errors';
import { snapshotToData } from './utils';
import type { UseCollectionOptions, UseCollectionResult } from './types';

/**
 * Reactive Firestore collection subscription using Svelte 5 runes.
 *
 * Subscribes to a Firestore query and provides reactive data, loading, error, and count state.
 * Automatically resubscribes when the query function returns a different query.
 * Cleans up the listener when the component is destroyed or the query changes.
 *
 * @param queryFn - Function returning a Firestore Query or null (null = no subscription)
 * @param options - Optional configuration for ID field injection and data transformation
 * @returns Reactive collection state
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useCollection } from '@warpkit/data-firestore';
 *   import { collection, query, where, orderBy, limit } from 'firebase/firestore';
 *
 *   const jobs = useCollection<Job>(
 *     () => query(
 *       collection(db, 'jobs'),
 *       where('uid', '==', userId),
 *       orderBy('timestamp', 'desc'),
 *       limit(25)
 *     )
 *   );
 * </script>
 *
 * {#if jobs.loading}
 *   <p>Loading...</p>
 * {:else if jobs.error}
 *   <p>Error: {jobs.error.message}</p>
 * {:else}
 *   {#each jobs.data as job}
 *     <p>{job.name}</p>
 *   {/each}
 * {/if}
 * ```
 */
export function useCollection<T = DocumentData>(
	queryFn: () => Query | null,
	options?: UseCollectionOptions<T>
): UseCollectionResult<T> {
	const idField = options?.idField ?? 'id';
	const transform = options?.transform;

	let data = $state<T[]>([]);
	let loading = $state(true);
	let error = $state<Error | null>(null);
	let count = $state(0);

	$effect(() => {
		const q = queryFn();

		if (!q) {
			data = [];
			loading = false;
			error = null;
			count = 0;
			return;
		}

		loading = true;
		error = null;

		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const docs: T[] = [];
				for (const docSnap of snapshot.docs) {
					if (transform) {
						docs.push(transform(docSnap.data()));
					} else {
						const converted = snapshotToData<T>(docSnap, idField);
						if (converted) {
							docs.push(converted);
						}
					}
				}
				data = docs;
				count = snapshot.size;
				loading = false;
				error = null;
			},
			(err) => {
				error = err;
				loading = false;
				reportError('firestore', err, {
					severity: 'error',
					handledLocally: true,
					context: { hook: 'useCollection' },
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
		get count() {
			return count;
		},
	};
}
