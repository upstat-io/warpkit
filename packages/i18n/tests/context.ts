import { defineMessages } from '@warpkit/i18n';
import { createI18nContext } from '@warpkit/i18n/svelte';

export const messages = defineMessages({ name: { message: 'Name' }, save: { message: 'Save' } });
export const context = createI18nContext<typeof messages>();
