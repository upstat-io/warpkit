<script lang="ts">
/**
 * DataClientProvider - Context Provider Component
 *
 * Provides DataClient context to child components.
 * Must wrap all components that use useQuery(), useData(), or getDataClient().
 *
 * @example
 * <DataClientProvider {client}>
 *   <App />
 * </DataClientProvider>
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
