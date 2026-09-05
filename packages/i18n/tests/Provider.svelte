<script lang="ts">
  import { untrack } from 'svelte';
  import type { I18n } from '@warpkit/i18n';
  import { context, messages } from './context';
  import Consumer from './Consumer.svelte';
  let { controller }: { controller: I18n<typeof messages> } = $props();
  context.provide(untrack(() => controller));
</script>
<Consumer />
