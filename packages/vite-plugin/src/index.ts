import type { Plugin, HmrContext, UserConfig } from 'vite';

export interface WarpKitPluginOptions {
	/**
	 * Glob patterns for route component files to pre-warm.
	 * These are merged into Vite's server.warmup.clientFiles to prevent
	 * dependency discovery reloads on first lazy-load navigation.
	 *
	 * Example: ['./src/pages/**\/*.svelte', './src/layouts/**\/*.svelte']
	 */
	routeComponents?: string[];
}

export function warpkitPlugin(options: WarpKitPluginOptions = {}): Plugin {
	return {
		name: 'warpkit',
		enforce: 'post',

		config(): UserConfig {
			return {
				server: {
					// Disable Vite's built-in error overlay — WarpKit's ErrorOverlay
					// handles all errors via global-handlers.ts (vite:error listener)
					hmr: {
						overlay: false
					},
					...(options.routeComponents && options.routeComponents.length > 0
						? {
								warmup: {
									clientFiles: options.routeComponents
								}
							}
						: {})
				}
			};
		},

		transform(code: string, id: string): string | undefined {
			if (!id.endsWith('.svelte')) {
				return undefined;
			}

			// Append HMR ID export to compiled Svelte output.
			// This runs after @sveltejs/vite-plugin-svelte (enforce: 'post'),
			// so the code is already compiled JS.
			return code + `\nexport const __warpkitHmrId = ${JSON.stringify(id)};\n`;
		},

		handleHotUpdate(ctx: HmrContext): void {
			if (!ctx.file.endsWith('.svelte')) {
				return;
			}

			// Send custom HMR event for WarpKit's component swap logic.
			// Does NOT suppress default HMR — Svelte's self-accept still runs.
			ctx.server.hot.send({
				type: 'custom',
				event: 'warpkit:component-update',
				data: { file: ctx.file, timestamp: ctx.timestamp }
			});
		}
	};
}
