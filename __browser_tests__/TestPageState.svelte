<script lang="ts">
	import { PageState } from '../src/core/PageState.svelte';
	import { NavigationErrorCode } from '../src/core/types';

	const pageState = new PageState();

	function navigateTo(path: string) {
		pageState.update({
			path,
			pathname: path,
			search: '',
			hash: '',
			params: {},
			route: { path, component: () => Promise.resolve({ default: {} as never }), meta: {} },
			appState: 'authenticated'
		});
	}

	function setNavigating() {
		pageState.setNavigating(true);
	}

	function clearNavigating() {
		pageState.setNavigating(false);
	}

	function setError() {
		pageState.setError({
			code: NavigationErrorCode.NOT_FOUND,
			message: 'Not found',
			requestedPath: '/unknown'
		});
	}

	function clearError() {
		pageState.clearError();
	}

	function setParams() {
		pageState.update({
			path: '/users/123',
			pathname: '/users/123',
			search: '?tab=settings',
			hash: '#section',
			params: { id: '123' },
			route: { path: '/users/:id', component: () => Promise.resolve({ default: {} as never }), meta: {} },
			appState: 'authenticated'
		});
	}
</script>

<div data-testid="path">{pageState.path}</div>
<div data-testid="pathname">{pageState.pathname}</div>
<div data-testid="search">{pageState.search.toString()}</div>
<div data-testid="hash">{pageState.hash}</div>
<div data-testid="params">{JSON.stringify(pageState.params)}</div>
<div data-testid="appState">{pageState.appState}</div>
<div data-testid="isNavigating">{String(pageState.isNavigating)}</div>
<div data-testid="error">{pageState.error ? pageState.error.message : 'null'}</div>

<button data-testid="navigate" onclick={() => navigateTo('/dashboard')}>Navigate</button>
<button data-testid="setNavigating" onclick={setNavigating}>Set Navigating</button>
<button data-testid="clearNavigating" onclick={clearNavigating}>Clear Navigating</button>
<button data-testid="setError" onclick={setError}>Set Error</button>
<button data-testid="clearError" onclick={clearError}>Clear Error</button>
<button data-testid="setParams" onclick={setParams}>Set Params</button>
