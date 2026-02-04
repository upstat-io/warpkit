/**
 * TypeDefinition unit tests
 */
import { describe, it, expect } from 'vitest';
import { TypeDefinition } from './type-definition';

describe('TypeDefinition', () => {
	describe('create()', () => {
		it('should create a TypeDefinition with the given key', () => {
			const def = TypeDefinition.create<{ id: string }>('test.key');
			expect(def.key).toBe('test.key');
		});

		it('should create a frozen TypeDefinition', () => {
			const def = TypeDefinition.create<unknown>('test.key');
			expect(Object.isFrozen(def)).toBe(true);
		});

		it('should have undefined _data (type carrier only)', () => {
			const def = TypeDefinition.create<{ count: number }>('test.typed');
			expect(def._data).toBeUndefined();
		});

		it('should create distinct definitions for different keys', () => {
			const def1 = TypeDefinition.create<unknown>('key.one');
			const def2 = TypeDefinition.create<unknown>('key.two');

			expect(def1.key).toBe('key.one');
			expect(def2.key).toBe('key.two');
			expect(def1).not.toBe(def2);
		});

		it('should allow creating definitions with complex types', () => {
			interface ComplexData {
				id: string;
				nested: {
					value: number;
					items: string[];
				};
			}

			const def = TypeDefinition.create<ComplexData>('complex.key');
			expect(def.key).toBe('complex.key');
			expect(Object.isFrozen(def)).toBe(true);
		});
	});
});
