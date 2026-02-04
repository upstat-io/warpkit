<script lang="ts">
	import { SvelteURLSearchParams } from '../src/core/SvelteURLSearchParams.svelte';

	const params = new SvelteURLSearchParams();

	function setFoo() {
		params.set('foo', 'bar');
	}

	function appendFoo() {
		params.append('foo', 'baz');
	}

	function deleteFoo() {
		params.delete('foo');
	}

	function replaceAll() {
		params.replaceAll('a=1&b=2&c=3');
	}
</script>

<div data-testid="toString">{params.toString()}</div>
<div data-testid="size">{params.size}</div>
<div data-testid="hasFoo">{String(params.has('foo'))}</div>
<div data-testid="getFoo">{params.get('foo') ?? 'null'}</div>

<button data-testid="setFoo" onclick={setFoo}>Set foo</button>
<button data-testid="appendFoo" onclick={appendFoo}>Append foo</button>
<button data-testid="deleteFoo" onclick={deleteFoo}>Delete foo</button>
<button data-testid="replaceAll" onclick={replaceAll}>Replace All</button>
