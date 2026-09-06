import { expect, test } from 'vitest';
import { renderWithWarpKit } from '../src/testing/renderWithWarpKit';
import RenderHelperTarget from './RenderHelperTarget.svelte';

test('awaited rendering retains the WarpKit helper and mounted context through navigation', async () => {
	const screen = await renderWithWarpKit(RenderHelperTarget, {
		routes: { authenticated: {
			routes: [
				{ path: '/first', component: async () => ({ default: RenderHelperTarget }), meta: {} },
				{ path: '/second', component: async () => ({ default: RenderHelperTarget }), meta: {} }
			],
			default: '/first'
		} },
		initialState: 'authenticated', initialPath: '/first', props: { title: 'Renderer contract' }
	});
	try {
		await expect.element(screen.getByRole('heading', { name: 'Renderer contract' })).toBeVisible();
		expect(screen.warpkit.page.pathname).toBe('/first');
		await expect.element(screen.getByTestId('helper-path')).toHaveTextContent('/first');
		await screen.warpkit.navigate('/second');
		await expect.element(screen.getByTestId('helper-path')).toHaveTextContent('/second');
	} finally {
		await screen.unmount();
		screen.warpkit.destroy();
	}
});
