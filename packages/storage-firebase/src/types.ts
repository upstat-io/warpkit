import type { StorageReference, FullMetadata } from 'firebase/storage';

/**
 * Result from a successful file upload.
 */
export interface UploadResult {
	/** Public download URL for the uploaded file */
	url: string;
	/** Storage reference to the uploaded file */
	ref: StorageReference;
	/** Full metadata of the uploaded file */
	metadata: FullMetadata;
}

/**
 * Return type for the useUpload hook.
 */
export interface UseUploadResult {
	/** Trigger an upload. Returns the download URL on success. */
	upload: (path: string, file: File | Blob, metadata?: Record<string, string>) => Promise<string>;
	/** Upload progress 0-100 */
	readonly progress: number;
	/** Whether an upload is in progress */
	readonly loading: boolean;
	/** Error from the last upload attempt, if any */
	readonly error: Error | null;
	/** Download URL of the last successful upload */
	readonly url: string | null;
	/** Cancel the in-progress upload */
	cancel: () => void;
}
