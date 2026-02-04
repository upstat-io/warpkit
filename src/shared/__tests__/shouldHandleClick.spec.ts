/**
 * shouldHandleClick Tests
 *
 * Tests for the click guard utility.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { shouldHandleClick } from '../shouldHandleClick';

describe('shouldHandleClick', () => {
	let mockEvent: MouseEvent;
	let mockAnchor: HTMLAnchorElement;

	beforeEach(() => {
		// Create a minimal mock anchor element
		mockAnchor = {
			hasAttribute: () => false,
			target: ''
		} as unknown as HTMLAnchorElement;

		// Create a minimal mock event
		mockEvent = {
			defaultPrevented: false,
			button: 0,
			metaKey: false,
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
			currentTarget: mockAnchor
		} as unknown as MouseEvent;
	});

	describe('should return false (let browser handle)', () => {
		it('when defaultPrevented is true', () => {
			mockEvent = { ...mockEvent, defaultPrevented: true } as MouseEvent;
			expect(shouldHandleClick(mockEvent, '/test')).toBe(false);
		});

		it('when button is not 0 (right click)', () => {
			mockEvent = { ...mockEvent, button: 2 } as MouseEvent;
			expect(shouldHandleClick(mockEvent, '/test')).toBe(false);
		});

		it('when button is not 0 (middle click)', () => {
			mockEvent = { ...mockEvent, button: 1 } as MouseEvent;
			expect(shouldHandleClick(mockEvent, '/test')).toBe(false);
		});

		it('when metaKey is pressed', () => {
			mockEvent = { ...mockEvent, metaKey: true } as MouseEvent;
			expect(shouldHandleClick(mockEvent, '/test')).toBe(false);
		});

		it('when ctrlKey is pressed', () => {
			mockEvent = { ...mockEvent, ctrlKey: true } as MouseEvent;
			expect(shouldHandleClick(mockEvent, '/test')).toBe(false);
		});

		it('when shiftKey is pressed', () => {
			mockEvent = { ...mockEvent, shiftKey: true } as MouseEvent;
			expect(shouldHandleClick(mockEvent, '/test')).toBe(false);
		});

		it('when altKey is pressed', () => {
			mockEvent = { ...mockEvent, altKey: true } as MouseEvent;
			expect(shouldHandleClick(mockEvent, '/test')).toBe(false);
		});

		it('for http:// URLs', () => {
			expect(shouldHandleClick(mockEvent, 'http://example.com')).toBe(false);
		});

		it('for https:// URLs', () => {
			expect(shouldHandleClick(mockEvent, 'https://example.com')).toBe(false);
		});

		it('for protocol-relative URLs (//)', () => {
			expect(shouldHandleClick(mockEvent, '//example.com/path')).toBe(false);
		});

		it('for mailto: URLs', () => {
			expect(shouldHandleClick(mockEvent, 'mailto:test@example.com')).toBe(false);
		});

		it('for tel: URLs', () => {
			expect(shouldHandleClick(mockEvent, 'tel:+1234567890')).toBe(false);
		});

		it('for javascript: URLs', () => {
			expect(shouldHandleClick(mockEvent, 'javascript:void(0)')).toBe(false);
		});

		it('for ftp: URLs', () => {
			expect(shouldHandleClick(mockEvent, 'ftp://files.example.com')).toBe(false);
		});

		it('when anchor has download attribute', () => {
			mockAnchor = {
				hasAttribute: (attr: string) => attr === 'download',
				target: ''
			} as unknown as HTMLAnchorElement;
			mockEvent = { ...mockEvent, currentTarget: mockAnchor } as MouseEvent;
			expect(shouldHandleClick(mockEvent, '/file.pdf')).toBe(false);
		});

		it('when target is _blank', () => {
			mockAnchor = {
				hasAttribute: () => false,
				target: '_blank'
			} as unknown as HTMLAnchorElement;
			mockEvent = { ...mockEvent, currentTarget: mockAnchor } as MouseEvent;
			expect(shouldHandleClick(mockEvent, '/test')).toBe(false);
		});
	});

	describe('should return true (handle internally)', () => {
		it('for simple relative paths', () => {
			expect(shouldHandleClick(mockEvent, '/dashboard')).toBe(true);
		});

		it('for root path', () => {
			expect(shouldHandleClick(mockEvent, '/')).toBe(true);
		});

		it('for nested paths', () => {
			expect(shouldHandleClick(mockEvent, '/users/123/profile')).toBe(true);
		});

		it('for paths with query strings', () => {
			expect(shouldHandleClick(mockEvent, '/search?q=test')).toBe(true);
		});

		it('for paths with hash', () => {
			expect(shouldHandleClick(mockEvent, '/page#section')).toBe(true);
		});

		it('for relative paths without leading slash', () => {
			expect(shouldHandleClick(mockEvent, 'dashboard')).toBe(true);
		});

		it('when currentTarget is null', () => {
			mockEvent = { ...mockEvent, currentTarget: null } as unknown as MouseEvent;
			expect(shouldHandleClick(mockEvent, '/test')).toBe(true);
		});
	});
});
