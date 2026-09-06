<script lang="ts">
	import { usePage } from '../src/hooks';
	const page = usePage();
	let { title }: { title: string } = $props();
</script>

<h1>{title}</h1>
<p data-testid="helper-path">{page.pathname}</p>
