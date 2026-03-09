/**
 * useUpload Hook Integration Tests
 *
 * Tests run against a real Firebase Storage emulator in a Docker container.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
	getStorage,
	connectStorageEmulator,
	type FirebaseStorage,
} from 'firebase/storage';
import { getStorageEmulator, stopStorageEmulator } from './storage-emulator-container';
import { useUpload } from '../useUpload.svelte';

describe('useUpload with Emulator', () => {
	let firebaseApp: FirebaseApp;
	let storage: FirebaseStorage;

	beforeAll(async () => {
		const result = await getStorageEmulator();

		firebaseApp = initializeApp({
			apiKey: 'fake-api-key',
			projectId: result.projectId,
			storageBucket: `${result.projectId}.appspot.com`,
		});

		storage = getStorage(firebaseApp);
		connectStorageEmulator(storage, result.emulatorHost, result.emulatorPort);
	}, 120_000);

	afterAll(async () => {
		if (firebaseApp) {
			await deleteApp(firebaseApp);
		}
		await stopStorageEmulator();
	});

	it('loading state tracks upload lifecycle', async () => {
		const uploader = useUpload(storage);

		expect(uploader.loading).toBe(false);

		const file = new Blob(['test content'], { type: 'text/plain' });
		const uploadPromise = uploader.upload('test/lifecycle.txt', file);

		// loading should be true during upload
		expect(uploader.loading).toBe(true);

		await uploadPromise;

		expect(uploader.loading).toBe(false);
	});

	it('url set on completion', async () => {
		const uploader = useUpload(storage);

		expect(uploader.url).toBeNull();

		const file = new Blob(['test content'], { type: 'text/plain' });
		const url = await uploader.upload('test/url-check.txt', file);

		expect(url).toBeDefined();
		expect(typeof url).toBe('string');
		expect(uploader.url).toBe(url);
	});

	it('progress updates during upload', async () => {
		const uploader = useUpload(storage);

		expect(uploader.progress).toBe(0);

		// Create a larger file to increase chance of seeing progress updates
		const data = new Uint8Array(1024 * 100); // 100KB
		const file = new Blob([data], { type: 'application/octet-stream' });

		await uploader.upload('test/progress.bin', file);

		// After completion, progress should be 100
		expect(uploader.progress).toBe(100);
	});

	it('error state set on failure', async () => {
		const uploader = useUpload(storage);

		expect(uploader.error).toBeNull();

		// Cancel immediately to trigger an error
		const file = new Blob([new Uint8Array(1024 * 500)], { type: 'application/octet-stream' });
		const uploadPromise = uploader.upload('test/cancel-for-error.bin', file);

		// Cancel while uploading
		uploader.cancel();

		try {
			await uploadPromise;
		} catch {
			// Expected — upload was cancelled
		}

		// After cancel, loading should be false
		expect(uploader.loading).toBe(false);
	});

	it('cancel aborts upload', async () => {
		const uploader = useUpload(storage);

		const file = new Blob([new Uint8Array(1024 * 500)], { type: 'application/octet-stream' });
		const uploadPromise = uploader.upload('test/cancel.bin', file);

		uploader.cancel();

		await expect(uploadPromise).rejects.toThrow();
		expect(uploader.loading).toBe(false);
	});
});
