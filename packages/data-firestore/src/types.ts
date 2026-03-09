import type { DocumentData } from 'firebase/firestore';

/**
 * Options for useCollection hook.
 */
export interface UseCollectionOptions<T = DocumentData> {
	/** Field name to inject the document ID into each result (default: 'id') */
	idField?: string;
	/** Optional transform function applied to each document's data */
	transform?: (data: DocumentData) => T;
}

/**
 * Options for useDocument hook.
 */
export interface UseDocumentOptions<T = DocumentData> {
	/** Field name to inject the document ID into each result (default: 'id') */
	idField?: string;
	/** Optional transform function applied to the document's data */
	transform?: (data: DocumentData) => T;
}

/**
 * Return type for useCollection hook.
 */
export interface UseCollectionResult<T> {
	/** The collection data array */
	readonly data: T[];
	/** Whether the initial load is in progress */
	readonly loading: boolean;
	/** Error from the snapshot listener, if any */
	readonly error: Error | null;
	/** Number of documents in the collection */
	readonly count: number;
}

/**
 * Return type for useDocument hook.
 */
export interface UseDocumentResult<T> {
	/** The document data, or null if not loaded or doesn't exist */
	readonly data: T | null;
	/** Whether the initial load is in progress */
	readonly loading: boolean;
	/** Error from the snapshot listener, if any */
	readonly error: Error | null;
	/** Whether the document exists in Firestore */
	readonly exists: boolean;
}
