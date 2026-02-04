/**
 * MemoryBrowserProvider Unit Tests
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { MemoryBrowserProvider } from '../MemoryBrowserProvider';

describe('MemoryBrowserProvider', () => {
	let provider: MemoryBrowserProvider;

	beforeEach(() => {
		provider = new MemoryBrowserProvider();
	});

	describe('constructor', () => {
		it('should initialize with default path /', () => {
			const location = provider.getLocation();
			expect(location.pathname).toBe('/');
			expect(location.search).toBe('');
			expect(location.hash).toBe('');
		});

		it('should initialize with custom initial path', () => {
			provider = new MemoryBrowserProvider('/dashboard');
			const location = provider.getLocation();
			expect(location.pathname).toBe('/dashboard');
		});

		it('should start with empty history state', () => {
			expect(provider.getHistoryState()).toBeNull();
		});

		it('should start with history index 0', () => {
			expect(provider.getCurrentIndex()).toBe(0);
		});
	});

	describe('getLocation', () => {
		it('should parse pathname correctly', () => {
			provider = new MemoryBrowserProvider('/users/123');
			expect(provider.getLocation().pathname).toBe('/users/123');
		});

		it('should parse search params', () => {
			provider = new MemoryBrowserProvider('/search?q=test&page=1');
			const location = provider.getLocation();
			expect(location.pathname).toBe('/search');
			expect(location.search).toBe('?q=test&page=1');
		});

		it('should parse hash', () => {
			provider = new MemoryBrowserProvider('/page#section');
			const location = provider.getLocation();
			expect(location.pathname).toBe('/page');
			expect(location.hash).toBe('#section');
		});

		it('should parse all components', () => {
			provider = new MemoryBrowserProvider('/page?q=1#section');
			const location = provider.getLocation();
			expect(location.pathname).toBe('/page');
			expect(location.search).toBe('?q=1');
			expect(location.hash).toBe('#section');
		});
	});

	describe('buildUrl / parseUrl', () => {
		it('should return path unchanged for buildUrl', () => {
			expect(provider.buildUrl('/test')).toBe('/test');
		});

		it('should return url unchanged for parseUrl', () => {
			expect(provider.parseUrl('/test')).toBe('/test');
		});
	});

	describe('push', () => {
		it('should add entry to history', () => {
			provider.push('/page1', { __warpkit: true, id: 1, position: 0, appState: 'auth' });
			expect(provider.getHistory()).toHaveLength(2);
			expect(provider.getCurrentIndex()).toBe(1);
		});

		it('should update location', () => {
			provider.push('/page1', { __warpkit: true, id: 1, position: 0, appState: 'auth' });
			expect(provider.getLocation().pathname).toBe('/page1');
		});

		it('should store state', () => {
			provider.push('/page1', { __warpkit: true, id: 1, position: 0, appState: 'auth' });
			const state = provider.getHistoryState();
			expect(state?.__warpkit).toBe(true);
			expect(state?.id).toBe(1);
			expect(state?.appState).toBe('auth');
		});

		it('should truncate forward history on push', () => {
			provider.push('/page1', { __warpkit: true, id: 1, position: 0, appState: 'auth' });
			provider.push('/page2', { __warpkit: true, id: 2, position: 0, appState: 'auth' });
			provider.go(-1); // Go back to page1

			// Push new page - should truncate page2
			provider.push('/page3', { __warpkit: true, id: 3, position: 0, appState: 'auth' });

			expect(provider.getHistory()).toHaveLength(3); // /, page1, page3
			expect(provider.getLocation().pathname).toBe('/page3');
		});

		it('should increment history position', () => {
			const initialPosition = provider.getHistoryPosition();
			provider.push('/page1', { __warpkit: true, id: 1, position: 0, appState: 'auth' });
			expect(provider.getHistoryPosition()).toBe(initialPosition + 1);
		});
	});

	describe('replace', () => {
		it('should replace current entry', () => {
			provider.replace('/replaced', { __warpkit: true, id: 1, position: 0, appState: 'auth' });
			expect(provider.getHistory()).toHaveLength(1);
			expect(provider.getLocation().pathname).toBe('/replaced');
		});

		it('should keep current history position', () => {
			const initialPosition = provider.getHistoryPosition();
			provider.replace('/replaced', { __warpkit: true, id: 1, position: 0, appState: 'auth' });
			expect(provider.getHistoryPosition()).toBe(initialPosition);
		});

		it('should update state', () => {
			provider.replace('/replaced', {
				__warpkit: true,
				id: 1,
				position: 0,
				appState: 'auth',
				data: { foo: 'bar' }
			});
			expect(provider.getHistoryState()?.data?.foo).toBe('bar');
		});
	});

	describe('go', () => {
		beforeEach(() => {
			provider.push('/page1', { __warpkit: true, id: 1, position: 1, appState: 'auth' });
			provider.push('/page2', { __warpkit: true, id: 2, position: 2, appState: 'auth' });
			provider.push('/page3', { __warpkit: true, id: 3, position: 3, appState: 'auth' });
		});

		it('should go back one entry', () => {
			provider.go(-1);
			expect(provider.getLocation().pathname).toBe('/page2');
			expect(provider.getCurrentIndex()).toBe(2);
		});

		it('should go back multiple entries', () => {
			provider.go(-2);
			expect(provider.getLocation().pathname).toBe('/page1');
			expect(provider.getCurrentIndex()).toBe(1);
		});

		it('should go forward', () => {
			provider.go(-2);
			provider.go(1);
			expect(provider.getLocation().pathname).toBe('/page2');
		});

		it('should no-op when going back past start', () => {
			provider.go(-10);
			expect(provider.getLocation().pathname).toBe('/page3'); // Unchanged
			expect(provider.getCurrentIndex()).toBe(3);
		});

		it('should no-op when going forward past end', () => {
			provider.go(10);
			expect(provider.getLocation().pathname).toBe('/page3'); // Unchanged
			expect(provider.getCurrentIndex()).toBe(3);
		});

		it('should fire popstate listeners', () => {
			const listener = mock(() => {});
			provider.onPopState(listener);

			provider.go(-1);

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('should provide direction to listener', () => {
			const listener = mock(() => {});
			provider.onPopState(listener);

			provider.go(-1);
			expect(listener).toHaveBeenCalledWith(expect.any(Object), 'back');

			provider.go(1);
			expect(listener).toHaveBeenCalledWith(expect.any(Object), 'forward');
		});
	});

	describe('onPopState', () => {
		it('should register listener', () => {
			const listener = mock(() => {});
			provider.onPopState(listener);
			provider.push('/page1', { __warpkit: true, id: 1, position: 1, appState: 'auth' });
			provider.go(-1);

			expect(listener).toHaveBeenCalled();
		});

		it('should return cleanup function', () => {
			const listener = mock(() => {});
			const cleanup = provider.onPopState(listener);

			cleanup();

			provider.push('/page1', { __warpkit: true, id: 1, position: 1, appState: 'auth' });
			provider.go(-1);

			expect(listener).not.toHaveBeenCalled();
		});

		it('should notify multiple listeners', () => {
			const listener1 = mock(() => {});
			const listener2 = mock(() => {});
			provider.onPopState(listener1);
			provider.onPopState(listener2);

			provider.push('/page1', { __warpkit: true, id: 1, position: 1, appState: 'auth' });
			provider.go(-1);

			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).toHaveBeenCalledTimes(1);
		});
	});

	describe('test helpers', () => {
		it('getHistory should return copy of history', () => {
			provider.push('/page1', { __warpkit: true, id: 1, position: 1, appState: 'auth' });
			const history = provider.getHistory();

			expect(history).toHaveLength(2);
			expect(history[0].path).toBe('/');
			expect(history[1].path).toBe('/page1');
		});

		it('simulatePopState should fire listeners', () => {
			const listener = mock(() => {});
			provider.onPopState(listener);

			provider.simulatePopState('back');

			expect(listener).toHaveBeenCalledWith(null, 'back');
		});
	});
});
