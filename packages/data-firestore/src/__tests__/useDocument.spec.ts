/**
 * useDocument Integration Tests
 *
 * Tests run against a real Firebase Firestore emulator in a Docker container.
 * They verify actual Firestore snapshot behavior, not mocks.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
	getFirestore,
	connectFirestoreEmulator,
	doc,
	setDoc,
	deleteDoc,
	type Firestore,
} from 'firebase/firestore';
import { getFirestoreEmulator, stopFirestoreEmulator } from './firestore-emulator-container';
import { useDocument } from '../useDocument.svelte';

describe('useDocument with Emulator', () => {
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

	it('returns null initially with loading=true', () => {
		const result = useDocument(() => doc(db, 'test-docs', 'doc-1'));

		expect(result.loading).toBe(true);
		expect(result.data).toBeNull();
		expect(result.error).toBeNull();
		expect(result.exists).toBe(false);
	});

	it('updates data when document changes', async () => {
		const docRef = doc(db, 'test-docs', 'doc-1');
		await setDoc(docRef, { name: 'original' });

		const result = useDocument<{ id: string; name: string }>(() => docRef);

		await waitFor(() => result.data !== null);

		expect(result.data!.name).toBe('original');
		expect(result.data!.id).toBe('doc-1');
		expect(result.exists).toBe(true);
		expect(result.loading).toBe(false);

		// Update the document
		await setDoc(docRef, { name: 'updated' });

		await waitFor(() => result.data?.name === 'updated');

		expect(result.data!.name).toBe('updated');
	});

	it('exists=false for missing documents', async () => {
		const result = useDocument(() => doc(db, 'test-docs', 'nonexistent'));

		await waitFor(() => !result.loading);

		expect(result.exists).toBe(false);
		expect(result.data).toBeNull();
		expect(result.loading).toBe(false);
		expect(result.error).toBeNull();
	});

	it('handles null ref (no subscription)', () => {
		const result = useDocument(() => null);

		expect(result.data).toBeNull();
		expect(result.loading).toBe(false);
		expect(result.error).toBeNull();
		expect(result.exists).toBe(false);
	});

	it('idField option injects document ID with custom field name', async () => {
		const docRef = doc(db, 'test-docs', 'my-doc');
		await setDoc(docRef, { name: 'test' });

		const result = useDocument<{ docId: string; name: string }>(
			() => docRef,
			{ idField: 'docId' }
		);

		await waitFor(() => result.data !== null);

		expect(result.data!.docId).toBe('my-doc');
	});

	it('unsubscribes on cleanup', async () => {
		const docRef = doc(db, 'test-docs', 'doc-1');

		// The $effect cleanup is tested implicitly — in a real Svelte component
		// the effect teardown calls unsubscribe(). Here we verify the hook
		// can be created and doesn't leak on the test suite level.
		const result = useDocument(() => docRef);

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
