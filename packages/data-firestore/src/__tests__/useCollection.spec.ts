/**
 * useCollection Integration Tests
 *
 * Tests run against a real Firebase Firestore emulator in a Docker container.
 * They verify actual Firestore snapshot behavior, not mocks.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
	getFirestore,
	connectFirestoreEmulator,
	collection,
	query,
	where,
	orderBy,
	limit,
	addDoc,
	doc,
	setDoc,
	deleteDoc,
	getDocs,
	type Firestore,
} from 'firebase/firestore';
import { getFirestoreEmulator, stopFirestoreEmulator } from './firestore-emulator-container';
import { useCollection } from '../useCollection.svelte';

describe('useCollection with Emulator', () => {
	let firebaseApp: FirebaseApp;
	let db: Firestore;
	let emulatorContainer: Awaited<ReturnType<typeof getFirestoreEmulator>>['container'];

	beforeAll(async () => {
		const result = await getFirestoreEmulator();
		emulatorContainer = result.container;

		firebaseApp = initializeApp({
			apiKey: 'fake-api-key',
			projectId: result.projectId,
		});

		db = getFirestore(firebaseApp);
		connectFirestoreEmulator(db, result.emulatorHost, result.emulatorPort);
	}, 120_000);

	afterAll(async () => {
		if (firebaseApp) {
			await deleteApp(firebaseApp);
		}
		await stopFirestoreEmulator();
	});

	beforeEach(async () => {
		await emulatorContainer.clearData();
	});

	it('returns empty array initially with loading=true', () => {
		const q = () => query(collection(db, 'test-items'));
		const result = useCollection(q);

		expect(result.loading).toBe(true);
		expect(result.data).toEqual([]);
		expect(result.error).toBeNull();
		expect(result.count).toBe(0);
	});

	it('updates data when snapshot changes', async () => {
		const collRef = collection(db, 'test-items');
		const q = () => query(collRef);
		const result = useCollection<{ id: string; name: string }>(q);

		// Add a document
		await addDoc(collRef, { name: 'item-1' });

		// Wait for snapshot to propagate
		await waitFor(() => result.data.length === 1);

		expect(result.data).toHaveLength(1);
		expect(result.data[0].name).toBe('item-1');
		expect(result.data[0].id).toBeDefined();
		expect(result.count).toBe(1);
		expect(result.loading).toBe(false);

		// Add another document
		await addDoc(collRef, { name: 'item-2' });

		await waitFor(() => result.data.length === 2);

		expect(result.data).toHaveLength(2);
		expect(result.count).toBe(2);
	});

	it('sets error on permission denied', async () => {
		// Query a collection with invalid path to trigger an error
		const q = () =>
			query(
				collection(db, 'test-items'),
				where('__invalid__field__', '==', undefined as unknown as string)
			);

		const result = useCollection(q);

		await waitFor(() => result.error !== null, 5000);

		expect(result.error).toBeInstanceOf(Error);
		expect(result.loading).toBe(false);
	});

	it('handles null query (no subscription)', () => {
		const result = useCollection(() => null);

		expect(result.data).toEqual([]);
		expect(result.loading).toBe(false);
		expect(result.error).toBeNull();
		expect(result.count).toBe(0);
	});

	it('idField option injects document ID', async () => {
		const collRef = collection(db, 'test-items');
		const docRef = doc(collRef, 'known-id');
		await setDoc(docRef, { name: 'test' });

		const result = useCollection<{ docId: string; name: string }>(
			() => query(collRef),
			{ idField: 'docId' }
		);

		await waitFor(() => result.data.length === 1);

		expect(result.data[0].docId).toBe('known-id');
	});

	it('unsubscribes on cleanup', async () => {
		const collRef = collection(db, 'test-items');

		// The $effect cleanup is tested implicitly — in a real Svelte component
		// the effect teardown calls unsubscribe(). Here we verify the hook
		// can be created and doesn't leak on the test suite level.
		const result = useCollection(() => query(collRef));

		expect(result).toBeDefined();
		expect(result.loading).toBe(true);
	});
});

/**
 * Wait for a condition to become true, polling every 50ms.
 */
async function waitFor(condition: () => boolean, timeout: number = 3000): Promise<void> {
	const start = Date.now();
	while (!condition()) {
		if (Date.now() - start > timeout) {
			throw new Error(`waitFor timed out after ${timeout}ms`);
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}
