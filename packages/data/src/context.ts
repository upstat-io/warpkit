/**
 * @warpkit/data Context
 *
 * Svelte context symbol and getter for DataClient.
 * Used by DataClientProvider to provide the client to child components.
 */

import { getContext } from 'svelte';
import type { DataClient } from './DataClient';

// ============================================================================
// Context Key
// ============================================================================

/**
 * Svelte context key for DataClient.
 * Use with getContext(DATA_CLIENT_CONTEXT) to access the client.
 */
export const DATA_CLIENT_CONTEXT: unique symbol = Symbol('warpkit:data-client');

/**
 * @deprecated Use DATA_CLIENT_CONTEXT instead
 */
export const QUERY_CLIENT_CONTEXT: typeof DATA_CLIENT_CONTEXT = DATA_CLIENT_CONTEXT;

// ============================================================================
// Context Getter
// ============================================================================

/**
 * Get the DataClient from Svelte context.
 * Must be called within a component that is a child of DataClientProvider.
 *
 * @throws Error if DataClient is not found in context
 * @returns The DataClient instance
 *
 * @example
 * const client = getDataClient();
 * const result = await client.fetch('monitors');
 */
export function getDataClient(): DataClient {
	const client = getContext<DataClient | undefined>(DATA_CLIENT_CONTEXT);
	if (!client) {
		throw new Error('DataClient not found. Make sure to wrap your component tree with DataClientProvider.');
	}
	return client;
}

/**
 * @deprecated Use getDataClient instead
 */
export const getQueryClient = getDataClient;
