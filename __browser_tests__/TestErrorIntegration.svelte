<script lang="ts">
	/**
	 * Test wrapper for WarpKit error integration tests
	 *
	 * Tests the full flow: WarpKit error -> errorStore -> ErrorOverlay
	 */
	import { onMount } from 'svelte';
	import WarpKitProvider from '../src/components/WarpKitProvider.svelte';
	import RouterView from '../src/components/RouterView.svelte';
	import ErrorOverlay from '../src/errors/ErrorOverlay.svelte';
	import { WarpKit, createStateRoutes } from '../src';
	import { MemoryBrowserProvider } from '../src/providers/browser/MemoryBrowserProvider';
	import { errorStore } from '../src/errors/error-store';
	import SuccessPage from './stubs/SuccessPage.svelte';

	type TestState = 'ready';

	// Route configuration with failing and succeeding routes
	const routes = createStateRoutes<TestState>({
		ready: {
			routes: [
				{
					path: '/success',
					component: () => Promise.resolve({ default: SuccessPage }),
					meta: {}
				},
				{
					path: '/fail-load',
					component: () => Promise.reject(new Error('Component load failed!')),
					meta: {}
				},
				{
					path: '/fail-network',
					component: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
					meta: {}
				}
			],
			default: '/success'
		}
	});

	// Create WarpKit with memory provider for testing (no real browser)
	const memoryProvider = new MemoryBrowserProvider('/success');
	const warpkit = new WarpKit<TestState>({
		routes,
		initialState: 'ready',
		providers: {
			browser: memoryProvider
		}
	});

	// State tracking for tests
	let isStarted = $state(false);
	let hasError = $state(false);
	let errorMessage = $state('');

	// Subscribe to error store
	$effect(() => {
		const unsubscribe = errorStore.subscribe((state) => {
			hasError = state.showErrorUI;
			errorMessage = state.currentError?.message ?? '';
		});
		return unsubscribe;
	});

	onMount(() => {
		// Clear any previous errors
		errorStore.clearHistory();

		warpkit.start().then(() => {
			isStarted = true;
		}).catch((err) => {
			console.error('WarpKit start failed:', err);
		});
		return () => warpkit.destroy();
	});

	// Navigation helpers for tests
	async function navigateToSuccess() {
		await warpkit.navigate('/success');
	}

	async function navigateToFailLoad() {
		await warpkit.navigate('/fail-load');
	}

	async function navigateToFailNetwork() {
		await warpkit.navigate('/fail-network');
	}

	function clearErrors() {
		errorStore.clearHistory();
	}
</script>

<!-- ErrorOverlay is placed outside WarpKitProvider for resilience -->
<ErrorOverlay />

<div data-testid="integration-wrapper">
	<!-- Test control buttons -->
	<button data-testid="nav-success" onclick={navigateToSuccess}>Navigate Success</button>
	<button data-testid="nav-fail-load" onclick={navigateToFailLoad}>Navigate Fail Load</button>
	<button data-testid="nav-fail-network" onclick={navigateToFailNetwork}>Navigate Fail Network</button>
	<button data-testid="clear-errors" onclick={clearErrors}>Clear Errors</button>

	<!-- State display for assertions -->
	<div data-testid="is-started">{isStarted}</div>
	<div data-testid="has-error">{hasError}</div>
	<div data-testid="error-message">{errorMessage}</div>

	<!-- The actual WarpKit app -->
	{#if isStarted}
		<WarpKitProvider {warpkit}>
			<RouterView />
		</WarpKitProvider>
	{/if}
</div>
