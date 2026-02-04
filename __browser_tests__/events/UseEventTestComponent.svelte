<script lang="ts">
	import { useEvent } from '../../src/events/useEvent.svelte.js';
	import type { WarpKitEventRegistry } from '../../src/events/types.js';

	interface Props {
		event: keyof WarpKitEventRegistry;
		enabled?: boolean;
		onEvent?: (payload: unknown) => void;
	}

	let { event, enabled = true, onEvent }: Props = $props();
	let receivedPayloads: unknown[] = $state([]);

	useEvent(
		event,
		(payload) => {
			receivedPayloads = [...receivedPayloads, payload];
			onEvent?.(payload);
		},
		{ enabled: () => enabled }
	);

	export function getReceivedPayloads(): unknown[] {
		return receivedPayloads;
	}
</script>

<div data-testid="use-event-test">
	Received: {receivedPayloads.length}
</div>
