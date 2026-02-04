/**
 * WarpKit Performance Benchmarks
 *
 * Comprehensive benchmarks covering ALL WarpKit code paths.
 *
 * Run with: bun run src/core/__benchmarks__/router.bench.ts
 */
import { bench, run, group } from 'mitata';
import { RouteMatcher } from '../RouteMatcher';
import { RouteCompiler } from '../RouteCompiler';
import { StateMachine } from '../StateMachine';
import { NavigationLifecycle } from '../NavigationLifecycle';
import { LayoutManager } from '../LayoutManager';
import { EventEmitter } from '../../events/EventEmitter';
import { MemoryBrowserProvider } from '../../providers/browser/MemoryBrowserProvider';
import { shouldHandleClick } from '../../shared/shouldHandleClick';
import type { Route, StateRoutes, NavigationContext, LayoutConfig } from '../types';

// ============================================================================
// Test Data Setup
// ============================================================================

function createRoute(path: string): Route {
	return {
		path,
		component: () => Promise.resolve({ default: {} as never }),
		meta: {}
	};
}

// Realistic route configuration for benchmarking (generic SaaS patterns)
const realisticRoutes: StateRoutes<'unauthenticated' | 'authenticated'> = {
	unauthenticated: {
		routes: [
			createRoute('/'),
			createRoute('/login'),
			createRoute('/signup')
		],
		default: '/login'
	},
	authenticated: {
		routes: [
			createRoute('/[org]'),
			createRoute('/[org]/dashboard'),
			createRoute('/[org]/items'),
			createRoute('/[org]/analytics'),
			createRoute('/[org]/catalog'),
			createRoute('/[org]/schedules/list'),
			createRoute('/[org]/schedules/[range]/[date]'),
			createRoute('/[org]/workflows'),
			createRoute('/[org]/docs'),
			createRoute('/[org]/automations'),
			createRoute('/[org]/pages'),
			createRoute('/[org]/maintenance'),
			createRoute('/[org]/notifications'),
			createRoute('/[org]/teams'),
			createRoute('/[org]/calendar'),
			createRoute('/[org]/reports'),
			createRoute('/[org]/project/[id]'),
			createRoute('/settings'),
			createRoute('/profile'),
			createRoute('/new-account')
		],
		default: (data) => {
			const d = data as { org?: string } | undefined;
			return d?.org ? `/${d.org}/` : '/';
		}
	}
};

// Pre-create matcher for match benchmarks
const matcher = new RouteMatcher(realisticRoutes);
const compiler = new RouteCompiler();

// ============================================================================
// Benchmarks
// ============================================================================

group('RouteMatcher.match() - static paths', () => {
	bench('match /login (static, unauthenticated)', () => {
		matcher.match('/login', 'unauthenticated');
	});

	bench('match /settings (static, authenticated)', () => {
		matcher.match('/settings', 'authenticated');
	});

	bench('match /profile (static, authenticated)', () => {
		matcher.match('/profile', 'authenticated');
	});
});

group('RouteMatcher.match() - param paths', () => {
	bench('match /acme/items (1 param)', () => {
		matcher.match('/acme/items', 'authenticated');
	});

	bench('match /acme/schedules/week/2024-01-15 (3 params)', () => {
		matcher.match('/acme/schedules/week/2024-01-15', 'authenticated');
	});

	bench('match /acme/project/abc-123 (2 params)', () => {
		matcher.match('/acme/project/abc-123', 'authenticated');
	});
});

group('RouteMatcher.match() - no match / state mismatch', () => {
	bench('match /unknown (no match)', () => {
		matcher.match('/unknown', 'authenticated');
	});

	bench('match /login in authenticated (state mismatch)', () => {
		matcher.match('/login', 'authenticated');
	});
});

group('RouteMatcher.tryExpandPath()', () => {
	const stateData = { org: 'acme' };

	bench('expand /items -> /acme/items', () => {
		matcher.tryExpandPath('/items', 'authenticated', stateData);
	});

	bench('expand /schedules/list -> /acme/schedules/list', () => {
		matcher.tryExpandPath('/schedules/list', 'authenticated', stateData);
	});

	bench('expand /settings (no expansion needed)', () => {
		matcher.tryExpandPath('/settings', 'authenticated', stateData);
	});

	bench('expand /unknown (no match)', () => {
		matcher.tryExpandPath('/unknown', 'authenticated', stateData);
	});
});

group('RouteCompiler.compile()', () => {
	bench('compile /dashboard (static)', () => {
		compiler.compile(createRoute('/dashboard'), 'auth');
	});

	bench('compile /[workspace]/incidents (1 param)', () => {
		compiler.compile(createRoute('/[workspace]/incidents'), 'auth');
	});

	bench('compile /[a]/[b]/[c]/[d] (4 params)', () => {
		compiler.compile(createRoute('/[a]/[b]/[c]/[d]'), 'auth');
	});
});

group('RouteMatcher constructor', () => {
	bench('create RouteMatcher with realistic routes (20 routes)', () => {
		new RouteMatcher(realisticRoutes);
	});
});

group('StateMachine', () => {
	bench('getState()', () => {
		const sm = new StateMachine('unauthenticated');
		sm.getState();
	});

	bench('getStateId()', () => {
		const sm = new StateMachine('unauthenticated');
		sm.getStateId();
	});

	bench('setState()', () => {
		const sm = new StateMachine<'a' | 'b'>('a');
		sm.setState('b');
	});

	bench('setState() with listener', () => {
		const sm = new StateMachine<'a' | 'b'>('a');
		sm.subscribe(() => {});
		sm.setState('b');
	});

	bench('subscribe/unsubscribe', () => {
		const sm = new StateMachine('a');
		const unsub = sm.subscribe(() => {});
		unsub();
	});
});

// ============================================================================
// EventEmitter Benchmarks
// ============================================================================

interface TestEvents {
	[event: string]: unknown;
	'test-event': { data: string };
	'no-payload': void;
	'complex': { a: number; b: string; c: boolean };
}

const eventEmitter = new EventEmitter<TestEvents>();

// Pre-register some listeners for emit benchmarks
const handler1 = () => {};
const handler2 = () => {};
const handler3 = () => {};
eventEmitter.on('test-event', handler1);
eventEmitter.on('test-event', handler2);
eventEmitter.on('test-event', handler3);

group('EventEmitter.on()', () => {
	bench('on() - register handler', () => {
		const emitter = new EventEmitter<TestEvents>();
		emitter.on('test-event', () => {});
	});

	bench('on() - first handler (creates Set)', () => {
		const emitter = new EventEmitter<TestEvents>();
		emitter.on('test-event', () => {});
	});

	bench('on() - subsequent handler (Set.add)', () => {
		const emitter = new EventEmitter<TestEvents>();
		emitter.on('test-event', () => {});
		emitter.on('test-event', () => {});
	});
});

group('EventEmitter.emit()', () => {
	bench('emit() with 3 handlers', () => {
		eventEmitter.emit('test-event', { data: 'hello' });
	});

	bench('emit() no handlers (fast path)', () => {
		eventEmitter.emit('no-payload');
	});

	bench('emit() void payload', () => {
		const emitter = new EventEmitter<TestEvents>();
		emitter.on('no-payload', () => {});
		emitter.emit('no-payload');
	});
});

group('EventEmitter.off()', () => {
	bench('off() via returned unsubscribe', () => {
		const emitter = new EventEmitter<TestEvents>();
		const unsub = emitter.on('test-event', () => {});
		unsub();
	});

	bench('off() via explicit call', () => {
		const emitter = new EventEmitter<TestEvents>();
		const handler = () => {};
		emitter.on('test-event', handler);
		emitter.off('test-event', handler);
	});
});

group('EventEmitter.once()', () => {
	bench('once() registration', () => {
		const emitter = new EventEmitter<TestEvents>();
		emitter.once('test-event', () => {});
	});

	bench('once() + emit (auto-unsubscribe)', () => {
		const emitter = new EventEmitter<TestEvents>();
		emitter.once('test-event', () => {});
		emitter.emit('test-event', { data: 'test' });
	});
});

group('EventEmitter - utility methods', () => {
	bench('listenerCount()', () => {
		eventEmitter.listenerCount('test-event');
	});

	bench('eventNames()', () => {
		eventEmitter.eventNames();
	});

	bench('clear()', () => {
		const emitter = new EventEmitter<TestEvents>();
		emitter.on('test-event', () => {});
		emitter.on('test-event', () => {});
		emitter.clear('test-event');
	});

	bench('clearAll()', () => {
		const emitter = new EventEmitter<TestEvents>();
		emitter.on('test-event', () => {});
		emitter.on('no-payload', () => {});
		emitter.clearAll();
	});
});

// ============================================================================
// NavigationLifecycle Benchmarks
// ============================================================================

const mockContext: NavigationContext = {
	from: null,
	to: {
		path: '/test',
		pathname: '/test',
		search: '',
		hash: '',
		params: {},
		route: createRoute('/test'),
		appState: 'authenticated'
	},
	type: 'push',
	direction: 'forward',
	navigationId: 1
};

group('NavigationLifecycle - registration', () => {
	bench('registerBeforeNavigate()', () => {
		const lifecycle = new NavigationLifecycle();
		lifecycle.registerBeforeNavigate(() => {});
	});

	bench('registerOnNavigate()', () => {
		const lifecycle = new NavigationLifecycle();
		lifecycle.registerOnNavigate(() => {});
	});

	bench('registerAfterNavigate()', () => {
		const lifecycle = new NavigationLifecycle();
		lifecycle.registerAfterNavigate(() => {});
	});

	bench('register + unsubscribe', () => {
		const lifecycle = new NavigationLifecycle();
		const unsub = lifecycle.registerBeforeNavigate(() => {});
		unsub();
	});
});

group('NavigationLifecycle - execution', () => {
	// No hooks
	const emptyLifecycle = new NavigationLifecycle();

	bench('runBeforeNavigate() - no hooks', async () => {
		await emptyLifecycle.runBeforeNavigate(mockContext);
	});

	bench('runOnNavigate() - no hooks', async () => {
		await emptyLifecycle.runOnNavigate(mockContext);
	});

	bench('runAfterNavigate() - no hooks', () => {
		emptyLifecycle.runAfterNavigate(mockContext);
	});

	// With hooks
	const lifecycle3Hooks = new NavigationLifecycle();
	lifecycle3Hooks.registerBeforeNavigate(() => {});
	lifecycle3Hooks.registerBeforeNavigate(() => {});
	lifecycle3Hooks.registerBeforeNavigate(() => {});

	bench('runBeforeNavigate() - 3 hooks (parallel)', async () => {
		await lifecycle3Hooks.runBeforeNavigate(mockContext);
	});

	const lifecycleOnNavigate = new NavigationLifecycle();
	lifecycleOnNavigate.registerOnNavigate(() => {});
	lifecycleOnNavigate.registerOnNavigate(() => {});

	bench('runOnNavigate() - 2 hooks (sequential)', async () => {
		await lifecycleOnNavigate.runOnNavigate(mockContext);
	});

	const lifecycleAfterNavigate = new NavigationLifecycle();
	lifecycleAfterNavigate.registerAfterNavigate(() => {});
	lifecycleAfterNavigate.registerAfterNavigate(() => {});

	bench('runAfterNavigate() - 2 hooks', () => {
		lifecycleAfterNavigate.runAfterNavigate(mockContext);
	});
});

// ============================================================================
// LayoutManager Benchmarks
// ============================================================================

const mockLayout: LayoutConfig = {
	id: 'main-layout',
	load: () => Promise.resolve({ default: {} as never })
};

const routeWithLayout = { ...createRoute('/dashboard'), layout: mockLayout };
const routeNoLayout = createRoute('/login');

group('LayoutManager', () => {
	bench('willLayoutChange() - no current layout', () => {
		const lm = new LayoutManager();
		lm.willLayoutChange(routeWithLayout);
	});

	bench('willLayoutChange() - same layout', async () => {
		const lm = new LayoutManager();
		await lm.resolveLayout(routeWithLayout);
		lm.willLayoutChange(routeWithLayout);
	});

	bench('willLayoutChange() - different layout', async () => {
		const lm = new LayoutManager();
		await lm.resolveLayout(routeWithLayout);
		lm.willLayoutChange(routeNoLayout);
	});

	bench('getCurrentLayoutId()', () => {
		const lm = new LayoutManager();
		lm.getCurrentLayoutId();
	});

	bench('clearCache()', () => {
		const lm = new LayoutManager();
		lm.clearCache();
	});

	bench('resolveLayout() - no layout', async () => {
		const lm = new LayoutManager();
		await lm.resolveLayout(routeNoLayout);
	});

	bench('resolveLayout() - with layout (cached)', async () => {
		const lm = new LayoutManager();
		await lm.resolveLayout(routeWithLayout);
		// Second call should use cache
		await lm.resolveLayout(routeWithLayout);
	});
});

// ============================================================================
// MemoryBrowserProvider Benchmarks
// ============================================================================

group('MemoryBrowserProvider', () => {
	bench('constructor', () => {
		new MemoryBrowserProvider('/');
	});

	bench('getLocation()', () => {
		const browser = new MemoryBrowserProvider('/dashboard?tab=1#section');
		browser.getLocation();
	});

	bench('getHistoryState()', () => {
		const browser = new MemoryBrowserProvider('/');
		browser.getHistoryState();
	});

	bench('buildUrl()', () => {
		const browser = new MemoryBrowserProvider('/');
		browser.buildUrl('/dashboard');
	});

	bench('parseUrl()', () => {
		const browser = new MemoryBrowserProvider('/');
		browser.parseUrl('/dashboard?a=1');
	});

	bench('push()', () => {
		const browser = new MemoryBrowserProvider('/');
		browser.push('/new', { __warpkit: true, id: 1, position: 0, appState: 'auth' });
	});

	bench('replace()', () => {
		const browser = new MemoryBrowserProvider('/');
		browser.replace('/new', { __warpkit: true, id: 1, position: 0, appState: 'auth' });
	});

	bench('go() - back', () => {
		const browser = new MemoryBrowserProvider('/');
		browser.push('/a', { __warpkit: true, id: 1, position: 1, appState: 'a' });
		browser.push('/b', { __warpkit: true, id: 2, position: 2, appState: 'a' });
		browser.go(-1);
	});

	bench('onPopState() - subscribe/unsubscribe', () => {
		const browser = new MemoryBrowserProvider('/');
		const unsub = browser.onPopState(() => {});
		unsub();
	});
});

// ============================================================================
// shouldHandleClick Benchmarks
// ============================================================================

// Create mock events for benchmarking
function createMockMouseEvent(overrides: Partial<MouseEvent> = {}): MouseEvent {
	return {
		defaultPrevented: false,
		button: 0,
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		currentTarget: null,
		...overrides
	} as MouseEvent;
}

group('shouldHandleClick()', () => {
	const normalEvent = createMockMouseEvent();
	const ctrlClickEvent = createMockMouseEvent({ ctrlKey: true });
	const rightClickEvent = createMockMouseEvent({ button: 2 });
	const preventedEvent = createMockMouseEvent({ defaultPrevented: true });

	bench('normal click - internal link', () => {
		shouldHandleClick(normalEvent, '/dashboard');
	});

	bench('normal click - external http', () => {
		shouldHandleClick(normalEvent, 'https://example.com');
	});

	bench('normal click - mailto', () => {
		shouldHandleClick(normalEvent, 'mailto:test@example.com');
	});

	bench('ctrl+click (modifier key)', () => {
		shouldHandleClick(ctrlClickEvent, '/dashboard');
	});

	bench('right click', () => {
		shouldHandleClick(rightClickEvent, '/dashboard');
	});

	bench('already prevented', () => {
		shouldHandleClick(preventedEvent, '/dashboard');
	});

	// With anchor element attributes
	const downloadAnchor = {
		hasAttribute: (attr: string) => attr === 'download',
		target: ''
	} as unknown as HTMLAnchorElement;

	const blankTargetAnchor = {
		hasAttribute: () => false,
		target: '_blank'
	} as unknown as HTMLAnchorElement;

	const eventWithDownload = createMockMouseEvent({ currentTarget: downloadAnchor });
	const eventWithBlank = createMockMouseEvent({ currentTarget: blankTargetAnchor });

	bench('download attribute', () => {
		shouldHandleClick(eventWithDownload, '/file.pdf');
	});

	bench('target=_blank', () => {
		shouldHandleClick(eventWithBlank, '/dashboard');
	});
});

// ============================================================================
// Full Pipeline Simulation Benchmarks
// ============================================================================

group('Full navigation simulation (sync parts)', () => {
	bench('match + expand + lifecycle check', () => {
		const m = new RouteMatcher(realisticRoutes);
		const lc = new NavigationLifecycle();
		const sm = new StateMachine<'unauthenticated' | 'authenticated'>('authenticated');

		// Match route
		const match = m.match('/acme/items', sm.getState());

		// Check lifecycle (no hooks = fast path)
		const hasHooks = lc['beforeNavigateHooks'].size > 0;

		// Result
		return { match, hasHooks };
	});

	bench('route compile + match + param extraction', () => {
		const rc = new RouteCompiler();
		const route = createRoute('/[project]/[section]/[id]');
		const compiled = rc.compile(route, 'auth');

		// Match
		const result = compiled.pattern.exec('/my-project/settings/abc-123');
		if (result) {
			const params: Record<string, string> = {};
			for (let i = 0; i < compiled.paramNames.length; i++) {
				params[compiled.paramNames[i]] = result[i + 1];
			}
			return params;
		}
		return null;
	});
});

// Run all benchmarks
await run({
	colors: true
});
