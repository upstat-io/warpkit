import {
	ref as storageRef,
	uploadBytes,
	uploadString as fbUploadString,
	getDownloadURL,
	type FirebaseStorage,
	type UploadMetadata,
	type StringFormat,
} from 'firebase/storage';
import { reportError } from '@warpkit/errors';
import type { UploadResult } from './types';

/**
 * Upload a File or Blob to Firebase Storage.
 *
 * Wraps `uploadBytes()` + `getDownloadURL()` with error reporting.
 *
 * @param storage - Firebase Storage instance
 * @param path - Storage path (e.g., 'avatars/user-123.jpg')
 * @param file - File or Blob to upload
 * @param metadata - Optional upload metadata (contentType, cacheControl, etc.)
 * @returns Upload result with URL, ref, and metadata
 */
export async function uploadFile(
	storage: FirebaseStorage,
	path: string,
	file: File | Blob,
	metadata?: UploadMetadata
): Promise<UploadResult> {
	try {
		const fileRef = storageRef(storage, path);
		const snapshot = await uploadBytes(fileRef, file, metadata);
		const url = await getDownloadURL(snapshot.ref);

		return {
			url,
			ref: snapshot.ref,
			metadata: snapshot.metadata,
		};
	} catch (error: unknown) {
		reportError('storage', error instanceof Error ? error : new Error(String(error)), {
			severity: 'error',
			handledLocally: false,
			context: { operation: 'uploadFile', path },
		});
		throw error;
	}
}

/**
 * Upload string data to Firebase Storage.
 *
 * Wraps `uploadString()` + `getDownloadURL()` with error reporting.
 * Useful for base64-encoded data, data URLs, or raw strings.
 *
 * @param storage - Firebase Storage instance
 * @param path - Storage path
 * @param data - String data to upload
 * @param format - String format ('raw', 'base64', 'base64url', 'data_url')
 * @param metadata - Optional upload metadata
 * @returns Upload result with URL, ref, and metadata
 */
export async function uploadString(
	storage: FirebaseStorage,
	path: string,
	data: string,
	format: StringFormat,
	metadata?: UploadMetadata
): Promise<UploadResult> {
	try {
		const fileRef = storageRef(storage, path);
		const snapshot = await fbUploadString(fileRef, data, format, metadata);
		const url = await getDownloadURL(snapshot.ref);

		return {
			url,
			ref: snapshot.ref,
			metadata: snapshot.metadata,
		};
	} catch (error: unknown) {
		reportError('storage', error instanceof Error ? error : new Error(String(error)), {
			severity: 'error',
			handledLocally: false,
			context: { operation: 'uploadString', path },
		});
		throw error;
	}
}
