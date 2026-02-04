import { describe, it, expect } from 'vitest';
import { Type } from '@sinclair/typebox';
import { extractDefaults } from './defaults';

describe('extractDefaults', () => {
	describe('simple defaults', () => {
		it('extracts string default', () => {
			const schema = Type.Object({
				name: Type.String({ default: 'Guest' })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ name: 'Guest' });
		});

		it('extracts number default', () => {
			const schema = Type.Object({
				age: Type.Number({ default: 0 })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ age: 0 });
		});

		it('extracts boolean default', () => {
			const schema = Type.Object({
				active: Type.Boolean({ default: true })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ active: true });
		});

		it('extracts multiple defaults', () => {
			const schema = Type.Object({
				name: Type.String({ default: '' }),
				age: Type.Number({ default: 0 }),
				active: Type.Boolean({ default: false })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({
				name: '',
				age: 0,
				active: false
			});
		});
	});

	describe('no defaults', () => {
		it('returns empty object when no defaults defined', () => {
			const schema = Type.Object({
				name: Type.String(),
				email: Type.String()
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({});
		});

		it('returns empty object for undefined schema', () => {
			const defaults = extractDefaults(undefined);

			expect(defaults).toEqual({});
		});

		it('returns empty object for schema without properties', () => {
			const schema = Type.String();

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({});
		});
	});

	describe('mixed defaults', () => {
		it('only includes fields with defaults', () => {
			const schema = Type.Object({
				name: Type.String({ default: 'Guest' }),
				email: Type.String(), // no default
				age: Type.Number({ default: 18 }),
				phone: Type.String() // no default
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({
				name: 'Guest',
				age: 18
			});
		});
	});

	describe('nested objects', () => {
		it('extracts defaults from nested objects', () => {
			const schema = Type.Object({
				user: Type.Object({
					name: Type.String({ default: 'Guest' })
				})
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({
				user: { name: 'Guest' }
			});
		});

		it('handles deeply nested defaults', () => {
			const schema = Type.Object({
				settings: Type.Object({
					notifications: Type.Object({
						email: Type.Boolean({ default: true }),
						sms: Type.Boolean({ default: false })
					})
				})
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({
				settings: {
					notifications: {
						email: true,
						sms: false
					}
				}
			});
		});

		it('skips nested objects without any defaults', () => {
			const schema = Type.Object({
				name: Type.String({ default: 'Guest' }),
				metadata: Type.Object({
					createdAt: Type.String(),
					updatedAt: Type.String()
				})
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ name: 'Guest' });
		});

		it('handles mixed nested and top-level defaults', () => {
			const schema = Type.Object({
				name: Type.String({ default: 'Guest' }),
				profile: Type.Object({
					bio: Type.String({ default: '' }),
					website: Type.String()
				}),
				age: Type.Number()
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({
				name: 'Guest',
				profile: { bio: '' }
			});
		});
	});

	describe('array defaults', () => {
		it('extracts array default at property level', () => {
			const schema = Type.Object({
				tags: Type.Array(Type.String(), { default: [] })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ tags: [] });
		});

		it('extracts array with initial values', () => {
			const schema = Type.Object({
				roles: Type.Array(Type.String(), { default: ['user'] })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ roles: ['user'] });
		});

		it('extracts array of objects with default', () => {
			const schema = Type.Object({
				addresses: Type.Array(
					Type.Object({
						street: Type.String(),
						city: Type.String()
					}),
					{ default: [] }
				)
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ addresses: [] });
		});
	});

	describe('special values', () => {
		it('handles null as default', () => {
			const schema = Type.Object({
				optional: Type.Union([Type.String(), Type.Null()], { default: null })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ optional: null });
		});

		it('handles empty string default', () => {
			const schema = Type.Object({
				name: Type.String({ default: '' })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ name: '' });
		});

		it('handles zero default', () => {
			const schema = Type.Object({
				count: Type.Number({ default: 0 })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ count: 0 });
		});

		it('handles false default', () => {
			const schema = Type.Object({
				disabled: Type.Boolean({ default: false })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ disabled: false });
		});
	});

	describe('complex schemas', () => {
		it('handles form-like schema', () => {
			const schema = Type.Object({
				email: Type.String({ default: '' }),
				password: Type.String(),
				rememberMe: Type.Boolean({ default: false }),
				newsletter: Type.Boolean({ default: true })
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({
				email: '',
				rememberMe: false,
				newsletter: true
			});
		});

		it('handles user profile schema', () => {
			const schema = Type.Object({
				username: Type.String(),
				profile: Type.Object({
					displayName: Type.String({ default: '' }),
					bio: Type.String({ default: '' }),
					avatar: Type.String()
				}),
				settings: Type.Object({
					theme: Type.String({ default: 'system' }),
					language: Type.String({ default: 'en' })
				})
			});

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({
				profile: {
					displayName: '',
					bio: ''
				},
				settings: {
					theme: 'system',
					language: 'en'
				}
			});
		});
	});

	describe('schema-level default', () => {
		it('returns schema-level default if present', () => {
			const schema = Type.Object(
				{
					name: Type.String(),
					age: Type.Number()
				},
				{
					default: { name: 'Default User', age: 25 }
				}
			);

			const defaults = extractDefaults(schema);

			expect(defaults).toEqual({ name: 'Default User', age: 25 });
		});
	});
});
