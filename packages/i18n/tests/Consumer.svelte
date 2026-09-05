<script lang="ts">
  import { context } from './context';
  const i18n = context.use();
  let name = $state('');
  const operationId = crypto.randomUUID();
</script>
<label for="name">{i18n.t('name')}</label>
<input id="name" data-testid="name" bind:value={name} />
<button data-testid="save">{i18n.t('save')}</button>
<output data-testid="operation">{operationId}</output>
<p data-testid="locale" lang={i18n.locale} dir={i18n.direction}>{i18n.locale}</p>
