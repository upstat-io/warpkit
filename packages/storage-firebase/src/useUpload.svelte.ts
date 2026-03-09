import {
	ref as storageRef,
	uploadBytesResumable,
	getDownloadURL,
	type FirebaseStorage,
	type UploadMetadata,
	type UploadTask,
} from 'firebase/storage';
import { reportError } from '@warpkit/errors';
import type { UseUploadResult } from './types';

/**
 * Reactive Firebase Storage upload hook using Svelte 5 runes.
 *
 * Provides reactive upload state (progress, loading, error, url) and
 * an upload function with cancellation support.
 *
 * Uses `uploadBytesResumable()` for progress tracking via `state_changed` events.
 *
 * @param storage - Firebase Storage instance
 * @returns Reactive upload state and control functions
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useUpload } from '@warpkit/storage-firebase';
 *
 *   const uploader = useUpload(storage);
 *
 *   async function handleFile(file: File) {
 *     const url = await uploader.upload(`avatars/${userId}`, file);
 *   }
 * </script>
 *
 * {#if uploader.loading}
 *   <progress value={uploader.progress} max="100" />
 * {/if}
 * ```
 */
export function useUpload(storage: FirebaseStorage): UseUploadResult {
	let progress = $state(0);
	let loading = $state(false);
	let error = $state<Error | null>(null);
	let url = $state<string | null>(null);
	let currentTask: UploadTask | null = null;

	async function upload(
		path: string,
		file: File | Blob,
		metadata?: UploadMetadata
	): Promise<string> {
		// Cancel any in-progress upload
		if (currentTask) {
			currentTask.cancel();
		}

		progress = 0;
		loading = true;
		error = null;
		url = null;

		const fileRef = storageRef(storage, path);
		const task = uploadBytesResumable(fileRef, file, metadata);
		currentTask = task;

		return new Promise<string>((resolve, reject) => {
			task.on(
				'state_changed',
				(snapshot) => {
					const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
					progress = Math.round(pct);
				},
				(err) => {
					// Don't report cancellation as an error
					if (err.code === 'storage/canceled') {
						loading = false;
						currentTask = null;
						reject(err);
						return;
					}

					error = err;
					loading = false;
					currentTask = null;

					reportError('storage', err, {
						severity: 'error',
						handledLocally: true,
						context: { hook: 'useUpload', path },
					});

					reject(err);
				},
				async () => {
					try {
						const downloadUrl = await getDownloadURL(task.snapshot.ref);
						url = downloadUrl;
						progress = 100;
						loading = false;
						currentTask = null;
						resolve(downloadUrl);
					} catch (err: unknown) {
						const e = err instanceof Error ? err : new Error(String(err));
						error = e;
						loading = false;
						currentTask = null;

						reportError('storage', e, {
							severity: 'error',
							handledLocally: true,
							context: { hook: 'useUpload', path, phase: 'getDownloadURL' },
						});

						reject(e);
					}
				}
			);
		});
	}

	function cancel(): void {
		if (currentTask) {
			currentTask.cancel();
			currentTask = null;
			loading = false;
		}
	}

	return {
		upload,
		get progress() {
			return progress;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get url() {
			return url;
		},
		cancel,
	};
}
