import { expect, it } from 'vitest';
import ts from 'typescript';
import { resolve } from 'node:path';

it('published declarations reject unknown keys, wrong types, missing and extra parameters', () => {
	const filename = resolve(import.meta.dirname, 'virtual-consumer.ts');
	const source = `
import { createI18n, defineMessages, type Catalogue } from '@warpkit/i18n';
const messages = defineMessages({
  hello: { message: 'Hello {name}', params: { name: 'string' } },
  items: { message: '{count, number}', params: { count: 'number' } },
  date: { message: '{instant, date}', params: { instant: 'date' } },
  save: { message: 'Save' }
});
const i18n = createI18n({ messages, locales: [{code: 'en', direction: 'ltr'}], fallbackLocale: 'en', locale: 'en', timeZone: 'UTC', catalogues: {} });
i18n.t('hello', {name: 'Sam'});
i18n.t('items', {count: 2});
i18n.t('date', {instant: new Date()});
i18n.t('save');
i18n.t('absent');
i18n.t('hello');
i18n.t('hello', {name: 42});
i18n.t('hello', {name: 'Sam', extra: true});
i18n.t('items', {count: '2'});
i18n.t('date', {instant: '2026-01-01'});
i18n.t('save', {});
const incomplete: Catalogue<typeof messages> = {save: 'Save'};
`;
	const options: ts.CompilerOptions = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, types: [] };
	const host = ts.createCompilerHost(options);
	const getSourceFile = host.getSourceFile.bind(host);
	host.getSourceFile = (path, languageVersion, onError, shouldCreate) => path === filename ? ts.createSourceFile(path, source, languageVersion, true) : getSourceFile(path, languageVersion, onError, shouldCreate);
	const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
	const errors = diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error);
	expect(errors.map((item) => item.file?.fileName)).toEqual(Array(8).fill(filename));
	expect(errors.map((item) => item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start).line + 1 : 0)).toEqual([14, 15, 16, 17, 18, 19, 20, 21]);
});
