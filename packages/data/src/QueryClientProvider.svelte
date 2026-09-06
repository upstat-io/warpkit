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

import { setContext, type Snippet, untrack } from 'svelte';
import { DATA_CLIENT_CONTEXT } from './context';
import type { DataClient } from './DataClient';

interface Props {
	/** The DataClient instance to provide */
	client: DataClient;
	/** Child content */
	children: Snippet;
}

const { children, ...rest }: Props = $props();

// setContext must run during initialisation, so the client is read once by
// design. Consumers receive the instance the app created at startup; a
// provider that swapped clients mid-life would need a getter-based context.
setContext(DATA_CLIENT_CONTEXT, untrack(() => rest.client));
</script>

{@render children()}
