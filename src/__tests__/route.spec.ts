/**
 * Route Factory Function Tests
 *
 * Tests createRoute and createStateRoutes factory functions.
 */
import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { createRoute, createStateRoutes } from '../route';

describe('createRoute', () => {
	describe('basic functionality', () => {
		it('should create a route with path and component', () => {
			const route = createRoute({
				path: '/dashboard',
				component: () => Promise.resolve({ default: {} as never })
			});

			expect(route.path).toBe('/dashboard');
			expect(route.component).toBeDefined();
			expect(route.meta).toEqual({});
		});

		it('should include provided meta', () => {
			const route = createRoute({
				path: '/dashboard',
				component: () => Promise.resolve({ default: {} as never }),
				meta: { title: 'Dashboard', requiresAuth: true }
			});

			expect(route.meta).toEqual({ title: 'Dashboard', requiresAuth: true });
		});

		it('should include layout if provided', () => {
			const layout = {
				id: 'app-layout',
				load: () => Promise.resolve({ default: {} as never })
			};

			const route = createRoute({
				path: '/dashboard',
				component: () => Promise.resolve({ default: {} as never }),
				layout
			});

			expect(route.layout).toBe(layout);
		});
	});

	describe('path validation', () => {
		it('should throw for path not starting with /', () => {
			expect(() =>
				createRoute({
					path: 'dashboard' as '/dashboard',
					component: () => Promise.resolve({ default: {} as never })
				})
			).toThrow("Route path 'dashboard' must start with '/'");
		});

		it('should throw for invalid param syntax', () => {
			expect(() =>
				createRoute({
					path: '/users/[123]' as '/users/[id]',
					component: () => Promise.resolve({ default: {} as never })
				})
			).toThrow("invalid parameter syntax '[123]'");
		});

		it('should throw for invalid catch-all syntax', () => {
			expect(() =>
				createRoute({
					path: '/files/[...123]' as '/files/[...path]',
					component: () => Promise.resolve({ default: {} as never })
				})
			).toThrow("invalid catch-all syntax '[...123]'");
		});

		it('should throw for catch-all not at end', () => {
			expect(() =>
				createRoute({
					path: '/files/[...path]/more' as '/files/[...path]',
					component: () => Promise.resolve({ default: {} as never })
				})
			).toThrow('catch-all parameter [...] must be the last segment');
		});

		it('should accept valid param names with underscore', () => {
			const route = createRoute({
				path: '/users/[user_id]',
				component: () => Promise.resolve({ default: {} as never })
			});

			expect(route.path).toBe('/users/[user_id]');
		});
	});

	describe('getParams', () => {
		it('should extract single param', () => {
			const route = createRoute({
				path: '/users/[id]',
				component: () => Promise.resolve({ default: {} as never })
			});

			const params = route.getParams({ id: '123', other: 'ignored' });
			expect(params).toEqual({ id: '123' });
		});

		it('should extract multiple params', () => {
			const route = createRoute({
				path: '/users/[userId]/posts/[postId]',
				component: () => Promise.resolve({ default: {} as never })
			});

			const params = route.getParams({ userId: 'u1', postId: 'p1', extra: 'x' });
			expect(params).toEqual({ userId: 'u1', postId: 'p1' });
		});

		it('should extract optional param', () => {
			const route = createRoute({
				path: '/projects/[id]/[tab?]',
				component: () => Promise.resolve({ default: {} as never })
			});

			const params = route.getParams({ id: '123', tab: 'settings' });
			expect(params).toEqual({ id: '123', tab: 'settings' });
		});

		it('should extract catch-all param', () => {
			const route = createRoute({
				path: '/files/[...path]',
				component: () => Promise.resolve({ default: {} as never })
			});

			const params = route.getParams({ path: 'a/b/c' });
			expect(params).toEqual({ path: 'a/b/c' });
		});

		it('should return empty object for static path', () => {
			const route = createRoute({
				path: '/about',
				component: () => Promise.resolve({ default: {} as never })
			});

			const params = route.getParams({ anything: 'ignored' });
			expect(params).toEqual({});
		});
	});

	describe('buildPath', () => {
		it('should build path with single param', () => {
			const route = createRoute({
				path: '/users/[id]',
				component: () => Promise.resolve({ default: {} as never })
			});

			expect(route.buildPath({ id: '123' })).toBe('/users/123');
		});

		it('should build path with multiple params', () => {
			const route = createRoute({
				path: '/users/[userId]/posts/[postId]',
				component: () => Promise.resolve({ default: {} as never })
			});

			expect(route.buildPath({ userId: 'u1', postId: 'p1' })).toBe('/users/u1/posts/p1');
		});

		it('should build path with optional param present', () => {
			const route = createRoute({
				path: '/projects/[id]/[tab?]',
				component: () => Promise.resolve({ default: {} as never })
			});

			expect(route.buildPath({ id: '123', tab: 'settings' })).toBe('/projects/123/settings');
		});

		it('should build path with optional param absent', () => {
			const route = createRoute({
				path: '/projects/[id]/[tab?]',
				component: () => Promise.resolve({ default: {} as never })
			});

			// Empty string for optional param should remove the segment
			expect(route.buildPath({ id: '123', tab: '' })).toBe('/projects/123');
		});

		it('should build path with catch-all param', () => {
			const route = createRoute({
				path: '/files/[...path]',
				component: () => Promise.resolve({ default: {} as never })
			});

			expect(route.buildPath({ path: 'a/b/c' })).toBe('/files/a/b/c');
		});

		it('should URL-encode param values', () => {
			const route = createRoute({
				path: '/search/[query]',
				component: () => Promise.resolve({ default: {} as never })
			});

			expect(route.buildPath({ query: 'hello world' })).toBe('/search/hello%20world');
		});

		it('should URL-encode each segment of catch-all separately', () => {
			const route = createRoute({
				path: '/files/[...path]',
				component: () => Promise.resolve({ default: {} as never })
			});

			expect(route.buildPath({ path: 'folder/file name.txt' })).toBe('/files/folder/file%20name.txt');
		});

		it('should return / for root path', () => {
			const route = createRoute({
				path: '/',
				component: () => Promise.resolve({ default: {} as never })
			});

			expect(route.buildPath({})).toBe('/');
		});
	});
});

describe('createStateRoutes', () => {
	let consoleWarnSpy: ReturnType<typeof spyOn<Console, 'warn'>>;

	beforeEach(() => {
		consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleWarnSpy.mockRestore();
	});

	describe('validation', () => {
		it('should throw for duplicate paths within a state', () => {
			expect(() =>
				createStateRoutes({
					auth: {
						routes: [
							createRoute({
								path: '/dashboard',
								component: () => Promise.resolve({ default: {} as never })
							}),
							createRoute({
								path: '/dashboard',
								component: () => Promise.resolve({ default: {} as never })
							})
						],
						default: '/dashboard'
					}
				})
			).toThrow("Duplicate route path '/dashboard' in state 'auth'");
		});

		it('should throw for invalid path pattern', () => {
			expect(() =>
				createStateRoutes({
					auth: {
						routes: [
							createRoute({
								path: '/users/[123]' as '/users/[id]',
								component: () => Promise.resolve({ default: {} as never })
							})
						],
						default: null
					}
				})
			).toThrow('invalid parameter syntax');
		});

		it('should throw for self-referencing redirect', () => {
			expect(() =>
				createStateRoutes({
					auth: {
						routes: [
							createRoute({
								path: '/dashboard',
								component: () => Promise.resolve({ default: {} as never })
							})
						],
						default: '/dashboard',
						redirects: { '/loop': '/loop' }
					}
				})
			).toThrow("Self-referencing redirect '/loop' → '/loop'");
		});

		it('should warn for default path not matching any route', () => {
			createStateRoutes({
				auth: {
					routes: [
						createRoute({
							path: '/dashboard',
							component: () => Promise.resolve({ default: {} as never })
						})
					],
					default: '/nonexistent'
				}
			});

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Default path '/nonexistent' in state 'auth'")
			);
		});

		it('should not warn when default matches a route', () => {
			createStateRoutes({
				auth: {
					routes: [
						createRoute({
							path: '/dashboard',
							component: () => Promise.resolve({ default: {} as never })
						})
					],
					default: '/dashboard'
				}
			});

			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it('should not warn when default is a redirect target', () => {
			createStateRoutes({
				auth: {
					routes: [
						createRoute({
							path: '/dashboard',
							component: () => Promise.resolve({ default: {} as never })
						})
					],
					default: '/dashboard',
					redirects: { '/': '/dashboard' }
				}
			});

			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it('should not warn when default is null', () => {
			createStateRoutes({
				loading: {
					routes: [],
					default: null
				}
			});

			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});
	});

	describe('return value', () => {
		it('should return the same config object', () => {
			const config = {
				auth: {
					routes: [
						createRoute({
							path: '/dashboard',
							component: () => Promise.resolve({ default: {} as never })
						})
					],
					default: '/dashboard'
				}
			};

			const result = createStateRoutes(config);
			expect(result).toBe(config);
		});

		it('should allow multiple states', () => {
			const result = createStateRoutes<'anon' | 'auth'>({
				anon: {
					routes: [
						createRoute({
							path: '/login',
							component: () => Promise.resolve({ default: {} as never })
						})
					],
					default: '/login'
				},
				auth: {
					routes: [
						createRoute({
							path: '/dashboard',
							component: () => Promise.resolve({ default: {} as never })
						})
					],
					default: '/dashboard'
				}
			});

			expect(result.anon).toBeDefined();
			expect(result.auth).toBeDefined();
		});

		it('should allow layout in state config', () => {
			const result = createStateRoutes({
				auth: {
					routes: [
						createRoute({
							path: '/dashboard',
							component: () => Promise.resolve({ default: {} as never })
						})
					],
					default: '/dashboard',
					layout: {
						id: 'app-layout',
						load: () => Promise.resolve({ default: {} as never })
					}
				}
			});

			expect(result.auth.layout).toBeDefined();
			expect(result.auth.layout?.id).toBe('app-layout');
		});
	});
});
