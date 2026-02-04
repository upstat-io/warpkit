/**
 * RouteCompiler Unit Tests
 *
 * Tests path-to-RegExp conversion and specificity scoring.
 */
import { describe, it, expect } from 'vitest';
import { RouteCompiler } from '../RouteCompiler';
import type { Route } from '../types';

function createRoute(path: string): Route {
	return {
		path,
		component: () => Promise.resolve({ default: {} as never }),
		meta: {}
	};
}

describe('RouteCompiler', () => {
	const compiler = new RouteCompiler();

	describe('compile', () => {
		it('should compile a route with correct state', () => {
			const route = createRoute('/dashboard');
			const compiled = compiler.compile(route, 'authenticated');

			expect(compiled.route).toBe(route);
			expect(compiled.state).toBe('authenticated');
			expect(compiled.pattern).toBeInstanceOf(RegExp);
		});
	});

	describe('static paths', () => {
		it('should match exact static path', () => {
			const route = createRoute('/dashboard');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/dashboard')).toBe(true);
			expect(compiled.pattern.test('/dashboard/')).toBe(true); // trailing slash allowed
			expect(compiled.pattern.test('/other')).toBe(false);
		});

		it('should match root path', () => {
			const route = createRoute('/');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/')).toBe(true);
			expect(compiled.pattern.test('/anything')).toBe(false);
		});

		it('should match multi-segment static path', () => {
			const route = createRoute('/projects/settings/general');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/projects/settings/general')).toBe(true);
			expect(compiled.pattern.test('/projects/settings')).toBe(false);
		});

		it('should escape regex special characters in static segments', () => {
			const route = createRoute('/file.txt');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/file.txt')).toBe(true);
			expect(compiled.pattern.test('/fileXtxt')).toBe(false); // . should not match any char
		});

		it('should assign score of 100 per static segment', () => {
			expect(compiler.compile(createRoute('/a'), 'test').score).toBe(100);
			expect(compiler.compile(createRoute('/a/b'), 'test').score).toBe(200);
			expect(compiler.compile(createRoute('/a/b/c'), 'test').score).toBe(300);
		});
	});

	describe('required parameters [param]', () => {
		it('should match single required param', () => {
			const route = createRoute('/users/[id]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/users/123')).toBe(true);
			expect(compiled.pattern.test('/users/abc')).toBe(true);
			expect(compiled.pattern.test('/users/')).toBe(false); // required, must have value
			expect(compiled.pattern.test('/users')).toBe(false);
		});

		it('should extract param name', () => {
			const route = createRoute('/users/[userId]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.paramNames).toEqual(['userId']);
		});

		it('should match multiple required params', () => {
			const route = createRoute('/users/[userId]/posts/[postId]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/users/u1/posts/p1')).toBe(true);
			expect(compiled.paramNames).toEqual(['userId', 'postId']);
		});

		it('should not match empty param value', () => {
			const route = createRoute('/users/[id]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/users/')).toBe(false);
			expect(compiled.pattern.test('/users//')).toBe(false);
		});

		it('should not match param with slashes', () => {
			const route = createRoute('/users/[id]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/users/a/b')).toBe(false);
		});

		it('should assign score of 10 per required param', () => {
			expect(compiler.compile(createRoute('/[a]'), 'test').score).toBe(10);
			expect(compiler.compile(createRoute('/[a]/[b]'), 'test').score).toBe(20);
			expect(compiler.compile(createRoute('/users/[id]'), 'test').score).toBe(110); // 100 + 10
		});
	});

	describe('optional parameters [param?]', () => {
		it('should match with or without optional param', () => {
			const route = createRoute('/users/[id?]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/users')).toBe(true);
			expect(compiled.pattern.test('/users/')).toBe(true);
			expect(compiled.pattern.test('/users/123')).toBe(true);
		});

		it('should extract optional param name', () => {
			const route = createRoute('/users/[id?]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.paramNames).toEqual(['id']);
		});

		it('should match optional param after required param', () => {
			const route = createRoute('/projects/[id]/[tab?]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/projects/123')).toBe(true);
			expect(compiled.pattern.test('/projects/123/settings')).toBe(true);
			expect(compiled.paramNames).toEqual(['id', 'tab']);
		});

		it('should assign score of 5 per optional param', () => {
			expect(compiler.compile(createRoute('/[a?]'), 'test').score).toBe(5);
			expect(compiler.compile(createRoute('/users/[id?]'), 'test').score).toBe(105); // 100 + 5
		});
	});

	describe('required catch-all [...param]', () => {
		it('should match one or more segments', () => {
			const route = createRoute('/files/[...path]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/files/a')).toBe(true);
			expect(compiled.pattern.test('/files/a/b')).toBe(true);
			expect(compiled.pattern.test('/files/a/b/c/d')).toBe(true);
			expect(compiled.pattern.test('/files')).toBe(false); // required, needs at least one
			expect(compiled.pattern.test('/files/')).toBe(false);
		});

		it('should extract catch-all param name', () => {
			const route = createRoute('/docs/[...slug]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.paramNames).toEqual(['slug']);
		});

		it('should assign score of 2 for required catch-all', () => {
			expect(compiler.compile(createRoute('/[...path]'), 'test').score).toBe(2);
			expect(compiler.compile(createRoute('/files/[...path]'), 'test').score).toBe(102); // 100 + 2
		});
	});

	describe('optional catch-all [...param?]', () => {
		it('should match zero or more segments', () => {
			const route = createRoute('/files/[...path?]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/files')).toBe(true);
			expect(compiled.pattern.test('/files/')).toBe(true);
			expect(compiled.pattern.test('/files/a')).toBe(true);
			expect(compiled.pattern.test('/files/a/b/c')).toBe(true);
		});

		it('should extract optional catch-all param name', () => {
			const route = createRoute('/docs/[...slug?]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.paramNames).toEqual(['slug']);
		});

		it('should assign score of 1 for optional catch-all', () => {
			expect(compiler.compile(createRoute('/[...path?]'), 'test').score).toBe(1);
			expect(compiler.compile(createRoute('/files/[...path?]'), 'test').score).toBe(101); // 100 + 1
		});
	});

	describe('specificity scoring', () => {
		it('should score static segments highest', () => {
			const staticRoute = compiler.compile(createRoute('/projects/new'), 'test');
			const paramRoute = compiler.compile(createRoute('/projects/[id]'), 'test');

			expect(staticRoute.score).toBeGreaterThan(paramRoute.score);
		});

		it('should score required params higher than optional params', () => {
			const requiredRoute = compiler.compile(createRoute('/users/[id]'), 'test');
			const optionalRoute = compiler.compile(createRoute('/users/[id?]'), 'test');

			expect(requiredRoute.score).toBeGreaterThan(optionalRoute.score);
		});

		it('should score optional params higher than catch-all', () => {
			const optionalRoute = compiler.compile(createRoute('/files/[name?]'), 'test');
			const catchAllRoute = compiler.compile(createRoute('/files/[...path]'), 'test');

			expect(optionalRoute.score).toBeGreaterThan(catchAllRoute.score);
		});

		it('should score required catch-all higher than optional catch-all', () => {
			const requiredCatchAll = compiler.compile(createRoute('/[...path]'), 'test');
			const optionalCatchAll = compiler.compile(createRoute('/[...path?]'), 'test');

			expect(requiredCatchAll.score).toBeGreaterThan(optionalCatchAll.score);
		});

		it('should correctly score complex routes from design doc', () => {
			// Examples from design doc
			expect(compiler.compile(createRoute('/dashboard'), 'test').score).toBe(100);
			expect(compiler.compile(createRoute('/projects'), 'test').score).toBe(100);
			expect(compiler.compile(createRoute('/projects/new'), 'test').score).toBe(200);
			expect(compiler.compile(createRoute('/projects/[id]'), 'test').score).toBe(110);
			expect(compiler.compile(createRoute('/projects/[id]/settings'), 'test').score).toBe(210);
			expect(compiler.compile(createRoute('/projects/[id]/monitors/[monitorId]'), 'test').score).toBe(220);
			expect(compiler.compile(createRoute('/projects/[id]/[tab?]'), 'test').score).toBe(115);
			expect(compiler.compile(createRoute('/projects/[id]/[...rest]'), 'test').score).toBe(112);
			expect(compiler.compile(createRoute('/files/[...path?]'), 'test').score).toBe(101);
			expect(compiler.compile(createRoute('/[...path]'), 'test').score).toBe(2);
			expect(compiler.compile(createRoute('/[...path?]'), 'test').score).toBe(1);
		});
	});

	describe('edge cases', () => {
		it('should handle trailing slash in source path', () => {
			// Path patterns shouldn't have trailing slash, but if they do, handle gracefully
			const route = createRoute('/users/');
			const compiled = compiler.compile(route, 'test');

			// Empty segment filtered out, so effectively /users
			expect(compiled.pattern.test('/users')).toBe(true);
			expect(compiled.pattern.test('/users/')).toBe(true);
		});

		it('should handle underscore in param names', () => {
			const route = createRoute('/users/[user_id]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.paramNames).toEqual(['user_id']);
			expect(compiled.pattern.test('/users/123')).toBe(true);
		});

		it('should handle numeric-looking param values', () => {
			const route = createRoute('/items/[id]');
			const compiled = compiler.compile(route, 'test');

			expect(compiled.pattern.test('/items/123')).toBe(true);
			expect(compiled.pattern.test('/items/0')).toBe(true);
			expect(compiled.pattern.test('/items/-1')).toBe(true);
		});

		it('should handle URL-encoded characters in matched paths', () => {
			const route = createRoute('/search/[query]');
			const compiled = compiler.compile(route, 'test');

			// The pattern matches the encoded string; decoding happens in RouteMatcher
			expect(compiled.pattern.test('/search/hello%20world')).toBe(true);
			expect(compiled.pattern.test('/search/foo%2Fbar')).toBe(true); // %2F is /
		});
	});

	describe('param extraction', () => {
		it('should capture param value in regex group', () => {
			const route = createRoute('/users/[id]');
			const compiled = compiler.compile(route, 'test');

			const match = compiled.pattern.exec('/users/123');
			expect(match).not.toBeNull();
			expect(match![1]).toBe('123');
		});

		it('should capture multiple params in order', () => {
			const route = createRoute('/users/[userId]/posts/[postId]');
			const compiled = compiler.compile(route, 'test');

			const match = compiled.pattern.exec('/users/u1/posts/p1');
			expect(match).not.toBeNull();
			expect(match![1]).toBe('u1');
			expect(match![2]).toBe('p1');
		});

		it('should capture empty string for unmatched optional param', () => {
			const route = createRoute('/users/[id?]');
			const compiled = compiler.compile(route, 'test');

			const match = compiled.pattern.exec('/users');
			expect(match).not.toBeNull();
			expect(match![1]).toBeUndefined(); // Group not matched
		});

		it('should capture catch-all value with slashes', () => {
			const route = createRoute('/files/[...path]');
			const compiled = compiler.compile(route, 'test');

			const match = compiled.pattern.exec('/files/a/b/c');
			expect(match).not.toBeNull();
			expect(match![1]).toBe('a/b/c');
		});
	});
});
