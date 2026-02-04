/**
 * RouteCompiler - Converts path patterns to RegExp with specificity scoring
 *
 * Scoring system ensures more specific routes match first:
 * - Static segment: +100 points
 * - Required param [id]: +10 points
 * - Optional param [id?]: +5 points
 * - Required catch-all [...rest]: +2 points
 * - Optional catch-all [...rest?]: +1 point
 */

import type { Route, CompiledRoute } from '../core/types.js';

/** Escape special RegExp characters in static path segments */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class RouteCompiler {
	/**
	 * Compile a route into a CompiledRoute with RegExp pattern and score.
	 *
	 * @param route - The route definition to compile
	 * @param state - The app state this route belongs to
	 * @returns Compiled route with pattern, param names, state, and specificity score
	 */
	public compile(route: Route, state: string): CompiledRoute {
		const { pattern, paramNames, score } = this.pathToRegex(route.path);

		return {
			route,
			pattern,
			paramNames,
			state,
			score
		};
	}

	/**
	 * Convert a path pattern into a RegExp, extract parameter names, and compute
	 * a specificity score. The score determines matching priority: higher-scored
	 * routes are tested before lower-scored ones.
	 *
	 * Path patterns are split into segments by '/'. Each segment contributes to
	 * the score and produces a RegExp fragment:
	 *
	 * | Segment type       | Example         | Score | RegExp fragment       |
	 * |--------------------|-----------------|-------|-----------------------|
	 * | Static             | `projects`      | +100  | `/projects`           |
	 * | Required param     | `[id]`          | +10   | `/([^/]+)`            |
	 * | Optional param     | `[id?]`         | +5    | `(?:/([^/]+))?`       |
	 * | Required catch-all | `[...path]`     | +2    | `/(.+)`               |
	 * | Optional catch-all | `[...path?]`    | +1    | `(?:/(.*))?`          |
	 */
	private pathToRegex(path: string): {
		pattern: RegExp;
		paramNames: string[];
		score: number;
	} {
		const paramNames: string[] = [];
		let score = 0;

		const segments = path.split('/').filter(Boolean);
		const regexParts: string[] = [];

		for (const segment of segments) {
			// Catch-all parameter: [...param] or [...param?]
			if (segment.startsWith('[...')) {
				const optional = segment.endsWith('?]');
				const name = segment.slice(4, optional ? -2 : -1);
				paramNames.push(name);
				score += optional ? 1 : 2;
				// Catch-all matches one or more path segments (required) or zero or more (optional)
				// Uses (.*) not (.+) for optional because empty string is valid
				regexParts.push(optional ? '(?:/(.*))?' : '/(.+)');
				continue;
			}

			// Regular parameter: [param] or [param?]
			if (segment.startsWith('[')) {
				const optional = segment.endsWith('?]');
				const name = segment.slice(1, optional ? -2 : -1);
				paramNames.push(name);
				score += optional ? 5 : 10;
				// [^/]+ matches exactly one non-empty path segment
				regexParts.push(optional ? '(?:/([^/]+))?' : '/([^/]+)');
				continue;
			}

			// Static segment — highest specificity
			score += 100;
			regexParts.push('/' + escapeRegex(segment));
		}

		const regexStr = regexParts.join('');

		// Root path '/' produces empty regexStr → match exactly '/'
		// Non-root paths allow optional trailing slash via /?$
		const finalRegex = regexStr ? '^' + regexStr + '/?$' : '^/$';

		return {
			pattern: new RegExp(finalRegex),
			paramNames,
			score
		};
	}
}
