<script lang="ts">
	/**
	 * Test wrapper for ErrorOverlay browser tests
	 */
	import ErrorOverlay from '../src/errors/ErrorOverlay.svelte';
	import { errorStore } from '../src/errors/error-store';

	// Expose store methods for testing via buttons
	function triggerError() {
		// Error objects have separate message and stack - message is just the message
		const error = new Error('Test error message');
		// Override stack for predictable testing
		error.stack = 'Error: Test error message\n    at TestComponent (test.js:10:5)\n    at render (svelte.js:100:3)';
		errorStore.setError(error);
	}

	function triggerFatalError() {
		errorStore.setError('Fatal error occurred', { severity: 'fatal', source: 'global' });
	}

	function triggerStringError() {
		errorStore.setError('Simple string error');
	}

	function clearError() {
		errorStore.clearCurrentError();
	}

	function hideUI() {
		errorStore.hideErrorUI();
	}

	// Expose store state for assertions
	let storeState = $state({ currentError: null as null | { message: string }, showErrorUI: false });

	$effect(() => {
		const unsubscribe = errorStore.subscribe((state) => {
			storeState = state;
		});
		return unsubscribe;
	});
</script>

<div data-testid="test-wrapper">
	<!-- Control buttons -->
	<button data-testid="trigger-error" onclick={triggerError}>Trigger Error</button>
	<button data-testid="trigger-fatal" onclick={triggerFatalError}>Trigger Fatal</button>
	<button data-testid="trigger-string" onclick={triggerStringError}>Trigger String Error</button>
	<button data-testid="clear-error" onclick={clearError}>Clear Error</button>
	<button data-testid="hide-ui" onclick={hideUI}>Hide UI</button>

	<!-- State display for assertions -->
	<div data-testid="has-error">{storeState.currentError !== null}</div>
	<div data-testid="show-ui">{storeState.showErrorUI}</div>
	<div data-testid="error-message">{storeState.currentError?.message ?? 'null'}</div>

	<!-- The actual ErrorOverlay component -->
	<ErrorOverlay />
</div>
