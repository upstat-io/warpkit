/**
 * BrowserProvider
 *
 * Default browser provider using HTML5 History API (pushState/replaceState).
 * Handles URL manipulation with optional base path support.
 */
import type {
	BrowserProvider,
	BrowserProviderConfig,
	BrowserLocation,
	HistoryState,
	PopStateCallback,
	WarpKitCore
} from '../interfaces';
import { extractHistoryState, notifyListeners } from './utils';

/**
 * Default implementation of BrowserProvider using HTML5 History API.
 */
export class DefaultBrowserProvider implements BrowserProvider {
	readonly id = 'browser' as const;

	private basePath: string;
	private historyPosition = 0;
	private popStateHandler: ((event: PopStateEvent) => void) | null = null;
	private listeners: Set<PopStateCallback> = new Set();

	constructor(config: BrowserProviderConfig = {}) {
		this.basePath = config.basePath ?? '';
		// Ensure basePath doesn't end with /
		if (this.basePath.endsWith('/')) {
			this.basePath = this.basePath.slice(0, -1);
		}
	}

	initialize(_warpkit: WarpKitCore): void {
		// Set scroll restoration to manual - we handle it via StorageProvider
		if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
			history.scrollRestoration = 'manual';
		}

		// Initialize history position from current state or 0
		const currentState = this.getHistoryState();
		this.historyPosition = currentState?.position ?? 0;

		// Set up popstate listener
		this.popStateHandler = (event: PopStateEvent) => {
			const state = extractHistoryState(event.state);
			const previousPosition = this.historyPosition;

			if (state) {
				this.historyPosition = state.position;
			}

			// Determine direction
			const direction = state && state.position < previousPosition ? 'back' : 'forward';
			notifyListeners(this.listeners, state, direction);
		};

		window.addEventListener('popstate', this.popStateHandler);
	}

	destroy(): void {
		if (this.popStateHandler) {
			window.removeEventListener('popstate', this.popStateHandler);
			this.popStateHandler = null;
		}
		this.listeners.clear();
	}

	getLocation(): BrowserLocation {
		const { pathname, search, hash } = window.location;
		return {
			pathname: this.stripBasePath(pathname),
			search,
			hash
		};
	}

	getHistoryState(): HistoryState | null {
		return extractHistoryState(history.state);
	}

	buildUrl(path: string): string {
		return this.basePath + path;
	}

	parseUrl(url: string): string {
		return this.stripBasePath(url);
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

	private stripBasePath(path: string): string {
		if (this.basePath && path.startsWith(this.basePath)) {
			const stripped = path.slice(this.basePath.length);
			return stripped || '/';
		}
		return path;
	}
}
