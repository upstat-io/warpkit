<script lang="ts">
	import { setContext } from 'svelte';
	import { WARPKIT_CONTEXT, type WarpKitContext, type WarpKit } from '../../src/context.js';
	import { EventEmitter } from '../../src/events/EventEmitter.js';
	import type { WarpKitEventRegistry } from '../../src/events/types.js';
	import UseEventTestComponent from './UseEventTestComponent.svelte';

	interface Props {
		event: keyof WarpKitEventRegistry;
		showComponent?: boolean;
		enabled?: boolean;
	}

	let { event, showComponent = true, enabled = true }: Props = $props();
	let receivedCount = $state(0);

	// Create event emitter for testing
	const events = new EventEmitter<WarpKitEventRegistry>();

	// Create minimal mock WarpKit with events
	const mockWarpKit: WarpKit = {
		events,
		// Stub other required properties (not used in these tests)
		page: {} as WarpKit['page'],
		ready: true,
		loadedComponent: null,
		loadedLayout: null,
		navigate: async () => ({ success: true }),
		setState: async () => {},
		buildUrl: (path: string) => path,
		registerBlocker: () => ({ unregister: () => {} }),
		getState: () => 'idle',
		getStateId: () => 0,
		start: async () => {},
		destroy: () => {},
		retry: async () => ({ success: true })
	};

	// Provide WarpKit context
	setContext<WarpKitContext>(WARPKIT_CONTEXT, {
		warpkit: mockWarpKit,
		page: mockWarpKit.page,
		routeComponent: null,
		layoutComponent: null,
		stateId: 0,
		retryLoad: () => {}
	});

	function handleEvent(payload: unknown) {
		receivedCount++;
	}

	function emitEvent() {
		if (event === 'auth:signed-in') {
			events.emit('auth:signed-in', { userId: 'test-user' });
		} else if (event === 'auth:signed-out') {
			events.emit('auth:signed-out');
		} else if (event === 'auth:token-refreshed') {
			events.emit('auth:token-refreshed');
		} else if (event === 'app:state-changed') {
			events.emit('app:state-changed', { from: 'old', to: 'new' });
		} else if (event === 'app:error') {
			events.emit('app:error', { error: new Error('test error') });
		} else if (event === 'query:invalidated') {
			events.emit('query:invalidated', { key: 'test-key' });
		} else if (event === 'query:fetched') {
			events.emit('query:fetched', { key: 'test-key', fromCache: false });
		}
	}

	function toggleComponent() {
		showComponent = !showComponent;
	}

	function resetCount() {
		receivedCount = 0;
	}
</script>

{#if showComponent}
	<UseEventTestComponent {event} {enabled} onEvent={handleEvent} />
{/if}

<div data-testid="received-count">{receivedCount}</div>
<button data-testid="emit-button" onclick={emitEvent}>Emit</button>
<button data-testid="toggle-component" onclick={toggleComponent}>Toggle</button>
<button data-testid="reset-count" onclick={resetCount}>Reset</button>
<button data-testid="toggle-enabled" onclick={() => enabled = !enabled}>Toggle Enabled</button>
<div data-testid="enabled-state">{enabled}</div>
