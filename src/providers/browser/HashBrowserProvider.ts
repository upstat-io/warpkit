/**
 * HashBrowserProvider
 *
 * Hash-based browser provider for #/path URLs.
 * Useful for static hosting where server-side routing isn't available.
 */
import type {
	BrowserProvider,
	BrowserLocation,
	HistoryState,
	PopStateCallback,
	WarpKitCore
} from '../interfaces';
import { extractHistoryState, notifyListeners } from './utils';

/**
 * Hash-based implementation of BrowserProvider.
 * Uses URL hash for routing (e.g., example.com/#/dashboard)
 */
export class HashBrowserProvider implements BrowserProvider {
	readonly id = 'browser' as const;

	private historyPosition = 0;
	private popStateHandler: ((event: PopStateEvent) => void) | null = null;
	private hashChangeHandler: ((event: HashChangeEvent) => void) | null = null;
	private listeners: Set<PopStateCallback> = new Set();
	private popStateProcessing = false;

	initialize(_warpkit: WarpKitCore): void {
		// Set scroll restoration to manual
		if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
			history.scrollRestoration = 'manual';
		}

		// Initialize history position from current state or 0
		const currentState = this.getHistoryState();
		this.historyPosition = currentState?.position ?? 0;

		// Set up popstate listener
		this.popStateHandler = (event: PopStateEvent) => {
			// Mark that we're processing popstate to prevent double handling
			this.popStateProcessing = true;

			const state = extractHistoryState(event.state);
			const previousPosition = this.historyPosition;

			if (state) {
				this.historyPosition = state.position;
			}

			const direction = state && state.position < previousPosition ? 'back' : 'forward';
			notifyListeners(this.listeners, state, direction);

			// Reset flag after a microtask (allows hashchange to see the flag)
			queueMicrotask(() => {
				this.popStateProcessing = false;
			});
		};

		// Set up hashchange listener (some browsers fire this instead of/in addition to popstate)
		this.hashChangeHandler = (_event: HashChangeEvent) => {
			// Skip if popstate already handled this
			if (this.popStateProcessing) {
				return;
			}

			const state = this.getHistoryState();
			const previousPosition = this.historyPosition;

			if (state) {
				this.historyPosition = state.position;
			}

			const direction = state && state.position < previousPosition ? 'back' : 'forward';
			notifyListeners(this.listeners, state, direction);
		};

		window.addEventListener('popstate', this.popStateHandler);
		window.addEventListener('hashchange', this.hashChangeHandler);
	}

	destroy(): void {
		if (this.popStateHandler) {
			window.removeEventListener('popstate', this.popStateHandler);
			this.popStateHandler = null;
		}
		if (this.hashChangeHandler) {
			window.removeEventListener('hashchange', this.hashChangeHandler);
			this.hashChangeHandler = null;
		}
		this.listeners.clear();
	}

	getLocation(): BrowserLocation {
		const hash = window.location.hash;
		return this.parseHashPath(hash);
	}

	getHistoryState(): HistoryState | null {
		return extractHistoryState(history.state);
	}

	buildUrl(path: string): string {
		return '#' + path;
	}

	parseUrl(url: string): string {
		// Extract path from hash URL
		if (url.startsWith('#')) {
			return this.parseHashPath(url).pathname;
		}
		return url;
	}

	push(path: string, state: HistoryState): void {
		this.historyPosition++;
		const stateWithPosition: HistoryState = {
			...state,
			position: this.historyPosition
		};

		const url = this.buildUrl(path);
		history.pushState(stateWithPosition, '', url);
	}

	replace(path: string, state: HistoryState): void {
		const stateWithPosition: HistoryState = {
			...state,
			position: this.historyPosition
		};

		const url = this.buildUrl(path);
		history.replaceState(stateWithPosition, '', url);
	}

	go(delta: number): void {
		history.go(delta);
	}

	onPopState(callback: PopStateCallback): () => void {
		this.listeners.add(callback);
		return () => {
			this.listeners.delete(callback);
		};
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private parseHashPath(hash: string): BrowserLocation {
		// Remove leading #
		let path = hash.startsWith('#') ? hash.slice(1) : hash;

		// Default to /
		if (!path || path === '') {
			path = '/';
		}

		let pathname = path;
		let search = '';
		let fragmentHash = '';

		// Handle nested hash for fragments (e.g., #/page#section)
		// The first # is the hash mode delimiter, subsequent # is fragment
		const nestedHashIndex = pathname.indexOf('#');
		if (nestedHashIndex !== -1) {
			fragmentHash = pathname.slice(nestedHashIndex);
			pathname = pathname.slice(0, nestedHashIndex);
		}

		// Extract search
		const searchIndex = pathname.indexOf('?');
		if (searchIndex !== -1) {
			search = pathname.slice(searchIndex);
			pathname = pathname.slice(0, searchIndex);
		}

		return { pathname, search, hash: fragmentHash };
	}
}
