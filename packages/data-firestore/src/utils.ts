import type { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';

/**
 * Convert a Firestore DocumentSnapshot to typed data with optional ID injection.
 *
 * Handles:
 * - Injecting the document ID as a field
 * - Converting Firestore Timestamps to Date objects
 * - Stripping undefined fields
 */
export function snapshotToData<T>(
	snapshot: DocumentSnapshot,
	idField: string = 'id'
): T | null {
	if (!snapshot.exists()) {
		return null;
	}

	const data = snapshot.data()!;
	const converted = convertTimestamps(data);

	return {
		...converted,
		[idField]: snapshot.id,
	} as T;
}

/**
 * Recursively convert Firestore Timestamp objects to Date objects.
 */
function convertTimestamps(data: DocumentData): DocumentData {
	const result: DocumentData = {};

	for (const [key, value] of Object.entries(data)) {
		if (value === undefined) {
			continue;
		}
		if (isTimestamp(value)) {
			result[key] = value.toDate();
		} else if (Array.isArray(value)) {
			result[key] = value.map((item) =>
				isTimestamp(item)
					? item.toDate()
					: item !== null && typeof item === 'object'
						? convertTimestamps(item)
						: item
			);
		} else if (value !== null && typeof value === 'object') {
			result[key] = convertTimestamps(value);
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Type guard for Firestore Timestamp objects.
 */
function isTimestamp(value: unknown): value is Timestamp {
	return (
		value !== null &&
		typeof value === 'object' &&
		'toDate' in value &&
		typeof (value as Timestamp).toDate === 'function'
	);
}
