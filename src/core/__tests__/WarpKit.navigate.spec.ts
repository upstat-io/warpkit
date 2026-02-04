import { describe, it, expect } from 'vitest';

/**
 * Tests for relative path resolution in WarpKit.navigate()
 *
 * These tests verify that the URL resolution logic works correctly
 * without needing a full WarpKit instance.
 */
describe('WarpKit.navigate relative path resolution', () => {
	// Helper that mimics the relative path resolution logic in WarpKit.navigate
	function resolveRelativePath(relativePath: string, currentPathname: string): string {
		if (relativePath.startsWith('/')) {
			return relativePath;
		}
		const base = new URL(currentPathname, 'http://x');
		const resolved = new URL(relativePath, base);
		return resolved.pathname;
	}

	describe('resolveRelativePath', () => {
		it('should return absolute paths unchanged', () => {
			expect(resolveRelativePath('/dashboard', '/ip/incidents')).toBe('/dashboard');
			expect(resolveRelativePath('/ip/incidents/new', '/ip/incidents')).toBe('/ip/incidents/new');
		});

		it('should resolve single segment relative path', () => {
			// From /ip/incidents, "new" should go to /ip/new (replaces last segment)
			expect(resolveRelativePath('new', '/ip/incidents')).toBe('/ip/new');
		});

		it('should resolve multi-segment relative path', () => {
			// From /ip/incidents, "incidents/new" should go to /ip/incidents/new
			expect(resolveRelativePath('incidents/new', '/ip/incidents')).toBe('/ip/incidents/new');
		});

		it('should handle trailing slash in current path', () => {
			// From /ip/incidents/, "new" should go to /ip/incidents/new
			expect(resolveRelativePath('new', '/ip/incidents/')).toBe('/ip/incidents/new');
		});

		it('should handle dot-dot navigation', () => {
			// From /ip/incidents/123, parent is /ip/incidents/, up one more is /ip/
			expect(resolveRelativePath('../new', '/ip/incidents/123')).toBe('/ip/new');
			// From /ip/incidents/123/details, "../edit" goes to /ip/incidents/123/edit
			expect(resolveRelativePath('../edit', '/ip/incidents/123/details')).toBe('/ip/incidents/edit');
		});

		it('should handle dot navigation', () => {
			// From /ip/incidents, "./new" should go to /ip/new
			expect(resolveRelativePath('./new', '/ip/incidents')).toBe('/ip/new');
		});

		it('should handle root path', () => {
			expect(resolveRelativePath('dashboard', '/')).toBe('/dashboard');
		});

		it('should handle deeply nested paths', () => {
			expect(resolveRelativePath('edit', '/ip/incidents/123/details')).toBe('/ip/incidents/123/edit');
		});
	});
});
