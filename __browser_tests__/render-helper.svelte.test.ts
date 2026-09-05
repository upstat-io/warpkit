import { afterEach, expect, it } from 'vitest';
import { cleanup } from 'vitest-browser-svelte';
import { renderWithWarpKit } from '../src/testing/renderWithWarpKit';
import Consumer from './TestContextConsumer.svelte';

afterEach(cleanup);
it('retains the WarpKit handle when the underlying renderer returns a thenable', async () => {
	const result = await renderWithWarpKit(Consumer, {
		initialState: 'ready', initialPath: '/',
		routes: { ready: { default: '/', routes: [{ path: '/', component: async () => ({ default: Consumer }), meta: {} }] } }
	});
	try {
		expect(result.warpkit.getState()).toBe('ready');
		await expect.element(result.getByTestId('context-check')).toHaveTextContent('Context Available');
	} finally { result.warpkit.destroy(); }
});
