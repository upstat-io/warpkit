<script lang="ts">
	import { useForm } from '../../packages/forms/src/index.js';
	import type { FormOptions, ValidationMode } from '../../packages/forms/src/index.js';
	import type { StandardSchema } from '@warpkit/validation';

	interface FormValues {
		name: string;
		email: string;
	}

	interface Props {
		initialValues: FormValues;
		schema?: StandardSchema<FormValues>;
		mode?: ValidationMode;
		revalidateMode?: 'blur' | 'change';
		delayError?: number;
		validators?: Record<string, (value: unknown, values: FormValues) => string | undefined | Promise<string | undefined>>;
		warners?: Record<string, (value: unknown, values: FormValues) => string | undefined | Promise<string | undefined>>;
		onSubmit?: (values: FormValues) => void | Promise<void>;
	}

	let {
		initialValues,
		schema,
		mode = 'submit',
		revalidateMode = 'change',
		delayError = 0,
		validators,
		warners,
		onSubmit
	}: Props = $props();

	const form = useForm({
		initialValues,
		schema: schema as FormOptions<FormValues>['schema'],
		mode,
		revalidateMode,
		delayError,
		validators,
		warners,
		onSubmit: onSubmit ?? (() => {})
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		form.submit();
	}

	function handleNameInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		form.data.name = target.value;
	}

	function handleEmailInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		form.data.email = target.value;
	}
</script>

<form onsubmit={handleSubmit}>
	<input
		data-testid="name"
		value={form.data.name}
		oninput={handleNameInput}
		onblur={() => form.touch('name')}
	/>

	<input
		data-testid="email"
		value={form.data.email}
		oninput={handleEmailInput}
		onblur={() => form.touch('email')}
	/>

	<!-- State displays -->
	<div data-testid="errors">{JSON.stringify(form.errors)}</div>
	<div data-testid="warnings">{JSON.stringify(form.warnings)}</div>
	<div data-testid="touched">{JSON.stringify(form.touched)}</div>
	<div data-testid="dirty">{JSON.stringify(form.dirty)}</div>
	<div data-testid="isValid">{form.isValid}</div>
	<div data-testid="isDirty">{form.isDirty}</div>
	<div data-testid="isSubmitting">{form.isSubmitting}</div>
	<div data-testid="isValidating">{form.isValidating}</div>
	<div data-testid="isSubmitted">{form.isSubmitted}</div>
	<div data-testid="submitError">{form.submitError?.message ?? ''}</div>
	<div data-testid="submitCount">{form.submitCount}</div>

	<button type="submit" data-testid="submit">Submit</button>
	<button type="button" data-testid="reset" onclick={() => form.reset()}>Reset</button>
</form>
