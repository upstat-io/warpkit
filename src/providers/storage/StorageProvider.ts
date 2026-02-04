/**
 * StorageProvider
 *
 * Default storage provider wrapping sessionStorage.
 * Handles scroll position storage with LRU eviction and intended path for deep links.
 */
import type { StorageProvider, StorageProviderConfig, ScrollPosition } from '../interfaces';

const SCROLL_POSITIONS_KEY = '__warpkit_scroll_positions__';
const INTENDED_PATH_KEY = '__warpkit_intended_path__';
const DEFAULT_MAX_POSITIONS = 50;

/**
 * Entry in the scroll positions storage.
 */
interface ScrollPositionEntry {
	position: ScrollPosition;
	timestamp: number;
}

/**
 * Default implementation using sessionStorage with LRU eviction.
 */
export class DefaultStorageProvider implements StorageProvider {
	readonly id = 'storage' as const;

	private maxPositions: number;

	constructor(config: StorageProviderConfig = {}) {
		this.maxPositions = config.maxScrollPositions ?? DEFAULT_MAX_POSITIONS;
	}

	saveScrollPosition(navigationId: number, position: ScrollPosition): void {
		try {
			const storage = this.getStorage();
			if (!storage) return;

			const positions = this.loadPositions(storage);

			// Add/update entry with current timestamp
			positions[navigationId] = {
				position,
				timestamp: Date.now()
			};

			// LRU eviction if over limit
			this.evictOldest(positions);

			storage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify(positions));
		} catch {
			// Graceful degradation - storage unavailable or quota exceeded
		}
	}

	getScrollPosition(navigationId: number): ScrollPosition | null {
		try {
			const storage = this.getStorage();
			if (!storage) return null;

			const positions = this.loadPositions(storage);
			const entry = positions[navigationId];

			return entry?.position ?? null;
		} catch {
			return null;
		}
	}

	saveIntendedPath(path: string): void {
		try {
			const storage = this.getStorage();
			if (!storage) return;

			storage.setItem(INTENDED_PATH_KEY, path);
		} catch {
			// Graceful degradation
		}
	}

	popIntendedPath(): string | null {
		try {
			const storage = this.getStorage();
			if (!storage) return null;

			const path = storage.getItem(INTENDED_PATH_KEY);
			if (path) {
				storage.removeItem(INTENDED_PATH_KEY);
			}
			return path;
		} catch {
			return null;
		}
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private getStorage(): Storage | null {
		if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
			return null;
		}
		return sessionStorage;
	}

	private loadPositions(storage: Storage): Record<number, ScrollPositionEntry> {
		const raw = storage.getItem(SCROLL_POSITIONS_KEY);
		if (!raw) return {};

		try {
			return JSON.parse(raw);
		} catch {
			return {};
		}
	}

	private evictOldest(positions: Record<number, ScrollPositionEntry>): void {
		const entries = Object.entries(positions);
		if (entries.length <= this.maxPositions) return;

		// Sort by timestamp ascending (oldest first)
		entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

		// Remove oldest entries until we're at the limit
		const toRemove = entries.length - this.maxPositions;
		for (let i = 0; i < toRemove; i++) {
			delete positions[Number(entries[i][0])];
		}
	}
}
