import {
	ref as storageRef,
	getDownloadURL,
	type FirebaseStorage,
} from 'firebase/storage';
import { reportError } from '@warpkit/errors';

/**
 * Get the download URL for a file in Firebase Storage.
 *
 * Wraps `getDownloadURL()` with error reporting.
 *
 * @param storage - Firebase Storage instance
 * @param path - Storage path (e.g., 'avatars/user-123.jpg')
 * @returns Public download URL
 */
export async function getUrl(
	storage: FirebaseStorage,
	path: string
): Promise<string> {
	try {
		const fileRef = storageRef(storage, path);
		return await getDownloadURL(fileRef);
	} catch (error: unknown) {
		reportError('storage', error instanceof Error ? error : new Error(String(error)), {
			severity: 'error',
			handledLocally: false,
			context: { operation: 'getUrl', path },
		});
		throw error;
	}
}
