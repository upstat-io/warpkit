<script lang="ts">
	/**
	 * Test component for verifying Svelte 5 reactivity in Playwright
	 */
	let count = $state(0);

	function increment() {
		count++;
	}
</script>

<div data-testid="count">{count}</div>
<button onclick={increment} data-testid="increment">Increment</button>
