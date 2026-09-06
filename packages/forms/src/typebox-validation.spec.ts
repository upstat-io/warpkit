import { describe, it, expect } from 'vitest';
import { Type } from '@sinclair/typebox';
import { validateSchema, validateSchemaAsync } from './validation';

const contact = Type.Object({ email: Type.String({ pattern: '^.+@.+$', error: 'Enter an email address.' }) });
const schema = Type.Object({ contact: Type.Union([contact, Type.Null()]) });

describe('native TypeBox union diagnostics', () => {
  it('retains the union summary and exposes nullable-object field errors in async and sync validation', async () => {
    const input = { contact: { email: 'invalid' } };
    const result = await validateSchemaAsync(schema, input);
    expect(result.valid).toBe(false);
    expect(result.errors.contact).toBeDefined();
    expect(result.errors['contact.email']).toBe('Enter an email address.');
    expect(validateSchema(schema, input)).toEqual(result);
  });

  it('valid null and object alternatives produce no errors', async () => {
    for (const input of [{ contact: null }, { contact: { email: 'person@example.test' } }]) {
      expect(await validateSchemaAsync(schema, input)).toEqual({ valid: true, errors: {} });
      expect(validateSchema(schema, input)).toEqual({ valid: true, errors: {} });
    }
  });

  it('traverses nested unions in array entries while preserving explicit parent messages', async () => {
    const nested = Type.Object({ entries: Type.Array(Type.Union([
      Type.Object({ contact: Type.Union([contact, Type.Null()]) }), Type.Null()
    ], { error: 'Check this entry.' })) });
    const input = { entries: [null, { contact: { email: 'invalid' } }] };
    const result = await validateSchemaAsync(nested, input);
    expect(result.errors['entries.1']).toBe('Check this entry.');
    expect(result.errors['entries.1.contact.email']).toBe('Enter an email address.');
    expect(result.errors['entries.0']).toBeUndefined();
    expect(validateSchema(nested, input)).toEqual(result);
  });

  it('preserves every alternative diagnostic without declaring a branch valid', async () => {
    const alternatives = Type.Union([
      Type.Object({ name: Type.String({ minLength: 1, error: 'Name required.' }) }),
      Type.Object({ count: Type.Integer({ minimum: 1, error: 'Positive count required.' }) })
    ]);
    const result = await validateSchemaAsync(alternatives, { name: '', count: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors._root).toBeDefined();
    expect(result.errors.name).toBe('Name required.');
    expect(result.errors.count).toBe('Positive count required.');
  });
});
