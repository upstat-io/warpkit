import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { I18nError, type Messages, type ParameterType } from './types';

function inspectArguments(elements: MessageFormatElement[], parameters: Readonly<Record<string, ParameterType>>, used: Set<string>): void {
	for (const element of elements) {
		if (element.type === TYPE.literal || element.type === TYPE.pound) continue;
		if (element.type === TYPE.tag) throw new I18nError('Messages must contain text, not rich-text tags');
		const name = element.value;
		if (!Object.hasOwn(parameters, name)) throw new I18nError(`Undeclared parameter: ${name}`);
		const kind = parameters[name];
		if (!['string', 'number', 'date'].includes(kind)) throw new I18nError(`Invalid parameter type: ${name}`);
		used.add(name);
		if (kind === 'date' && element.type === TYPE.argument) {
			throw new I18nError(`Date parameters require ICU date/time formatting: ${name}`);
		}
		if ((element.type === TYPE.number || element.type === TYPE.plural) && kind !== 'number') {
			throw new I18nError(`Numeric argument requires a number parameter: ${name}`);
		}
		if ((element.type === TYPE.date || element.type === TYPE.time) && kind !== 'date') {
			throw new I18nError(`Date/time argument requires a date parameter: ${name}`);
		}
		if (element.type === TYPE.select && kind !== 'string') throw new I18nError(`Select requires a string parameter: ${name}`);
		if (element.type === TYPE.plural || element.type === TYPE.select) {
			for (const option of Object.values(element.options)) inspectArguments(option.value, parameters, used);
		}
	}
}

/** Validate external JSON as well as statically authored catalogues. No fallback hides incomplete coverage. */
export function validateCatalogue(messages: Messages, catalogue: unknown): Map<string, MessageFormatElement[]> {
	if (typeof catalogue !== 'object' || catalogue === null || Array.isArray(catalogue)) {
		throw new I18nError('Catalogue must be an object');
	}
	const entries = new Map(Object.entries(catalogue));
	const keys = Object.keys(messages);
	if (entries.size !== keys.length || keys.some((key) => !entries.has(key))) {
		throw new I18nError('Catalogue keys must exactly match the message contract');
	}
	const compiled = new Map<string, MessageFormatElement[]>();
	for (const key of keys) {
		const text: unknown = entries.get(key);
		if (typeof text !== 'string' || text.trim() === '') throw new I18nError(`Message must be non-empty text: ${key}`);
		try {
			const ast = parse(text, { requiresOtherClause: true });
			const parameters = messages[key].params ?? {};
			const used = new Set<string>();
			inspectArguments(ast, parameters, used);
			if (Object.keys(parameters).some((name) => !used.has(name))) throw new I18nError('Declared parameter is missing from translation');
			compiled.set(key, ast);
		} catch (cause) {
			throw new I18nError(`Invalid message: ${key}`, { cause });
		}
	}
	return compiled;
}
