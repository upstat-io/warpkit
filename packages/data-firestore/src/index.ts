/**
 * @warpkit/data-firestore
 *
 * Svelte 5 reactive Firestore subscriptions for WarpKit.
 *
 * Provides `useCollection` and `useDocument` hooks that wrap Firestore
 * `onSnapshot` with Svelte 5 runes for reactive state management.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useCollection, useDocument } from '@warpkit/data-firestore';
 *   import { collection, query, where, doc } from 'firebase/firestore';
 *
 *   const jobs = useCollection<Job>(
 *     () => query(collection(db, 'jobs'), where('uid', '==', userId))
 *   );
 *
 *   const user = useDocument<UserProfile>(
 *     () => doc(db, 'users', userId)
 *   );
 * </script>
 * ```
 *
 * @packageDocumentation
 */

// Hooks
export { useCollection } from './useCollection.svelte';
export { useDocument } from './useDocument.svelte';

// Utilities
export { snapshotToData } from './utils';

// Types
export type {
	UseCollectionOptions,
	UseCollectionResult,
	UseDocumentOptions,
	UseDocumentResult,
} from './types';
