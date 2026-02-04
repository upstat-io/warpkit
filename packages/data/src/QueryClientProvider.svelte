<script lang="ts">
/**
 * @deprecated Use DataClientProvider instead
 *
 * QueryClientProvider - Context Provider Component (DEPRECATED)
 *
 * Provides DataClient context to child components.
 * Must wrap all components that use useQuery() or getDataClient().
 *
 * @example
 * <QueryClientProvider {client}>
 *   <App />
 * </QueryClientProvider>
 */

import { setContext, type Snippet } from 'svelte';
import { DATA_CLIENT_CONTEXT } from './context';
import type { DataClient } from './DataClient';

interface Props {
	/** The DataClient instance to provide */
	client: DataClient;
	/** Child content */
	children: Snippet;
}

let { client, children }: Props = $props();

setContext(DATA_CLIENT_CONTEXT, client);
</script>

{@render children()}
