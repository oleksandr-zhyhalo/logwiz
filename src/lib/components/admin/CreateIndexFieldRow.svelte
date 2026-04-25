<script lang="ts">
	import { ChevronDown, ChevronRight, Trash2 } from 'lucide-svelte';

	import type {
		ArrayFieldInput,
		FieldMappingInput,
		LogwizFieldRole,
		ScalarFieldInput
	} from '$lib/types';

	let {
		field = $bindable(),
		expanded = $bindable(false),
		canDelete,
		onDelete,
		assignRole,
		error
	}: {
		field: FieldMappingInput;
		expanded: boolean;
		canDelete: boolean;
		onDelete: () => void;
		assignRole: (role: LogwizFieldRole | null) => void;
		error?: string;
	} = $props();

	const SCALAR_TYPES = [
		'text',
		'i64',
		'u64',
		'f64',
		'bool',
		'datetime',
		'bytes',
		'json',
		'ip'
	] as const;

	const effectiveType = $derived(field.type === 'array' ? field.inner.type : field.type);
	const isText = $derived(field.type === 'text');

	const ROLE_BADGE: Record<LogwizFieldRole, string> = {
		level: 'L',
		message: 'M',
		traceback: 'T'
	};

	function scalarDefault(type: ScalarFieldInput['type']): ScalarFieldInput {
		const base = { name: '', stored: true, indexed: true, fast: false };
		switch (type) {
			case 'text':
				return { ...base, type, tokenizer: 'default', record: 'basic' };
			case 'datetime':
				return { ...base, fast: true, type, fast_precision: 'milliseconds' };
			case 'bytes':
				return { ...base, type, input_format: 'base64' };
			case 'json':
				return { ...base, type, tokenizer: 'default' };
			case 'i64':
			case 'u64':
			case 'f64':
				return { ...base, type };
			case 'bool':
			case 'ip':
				return { ...base, type };
		}
	}

	function changeType(next: string) {
		if (next === field.type) return;
		if (next === 'array') {
			const inner = scalarDefault('text');
			const wrapped: ArrayFieldInput = {
				name: field.name,
				type: 'array',
				stored: field.stored,
				indexed: field.indexed,
				fast: field.fast,
				inContext: field.inContext,
				inner: { ...inner, name: field.name }
			};
			field = wrapped;
			return;
		}
		const scalar = scalarDefault(next as ScalarFieldInput['type']);
		field = {
			...scalar,
			name: field.name,
			stored: field.stored,
			indexed: field.indexed,
			fast: field.fast,
			inContext: field.inContext,
			logwizRole: scalar.type === 'text' ? field.logwizRole : undefined
		} as FieldMappingInput;
	}

	function changeInnerType(next: string) {
		if (field.type !== 'array') return;
		const inner = scalarDefault(next as ScalarFieldInput['type']);
		field = {
			...field,
			inner: { ...inner, name: field.name }
		};
	}

	function setRole(value: string) {
		assignRole(value === '' ? null : (value as LogwizFieldRole));
	}

	// Helpers to read/write type-specific params on the active scalar
	// (either `field` itself, or `field.inner` when wrapped in an array).
	// Using imperative updates avoids `bind:` to type-cast expressions.
	function updateScalar(patch: Partial<ScalarFieldInput>) {
		if (field.type === 'array') {
			field = {
				...field,
				inner: { ...field.inner, ...patch } as ScalarFieldInput
			};
		} else {
			field = { ...field, ...patch } as FieldMappingInput;
		}
	}

	function getScalar(): ScalarFieldInput | null {
		return field.type === 'array' ? field.inner : field;
	}

	function onNameInput(e: Event) {
		const value = (e.currentTarget as HTMLInputElement).value;
		if (field.type === 'array') {
			// Keep field.inner.name in sync with field.name so the wire mapper
			// can drop inner.name without losing identity.
			field = { ...field, name: value, inner: { ...field.inner, name: value } };
		} else {
			field = { ...field, name: value } as FieldMappingInput;
		}
	}

	function onTextTokenizer(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement)
			.value as ScalarFieldInput extends { tokenizer: infer T } ? T : never;
		updateScalar({ tokenizer: value } as Partial<ScalarFieldInput>);
	}

	function onTextRecord(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value;
		updateScalar({ record: value } as Partial<ScalarFieldInput>);
	}

	function onTextFieldnorms(e: Event) {
		const value = (e.currentTarget as HTMLInputElement).checked;
		updateScalar({ fieldnorms: value } as Partial<ScalarFieldInput>);
	}

	function onDatetimeInputFormats(e: Event) {
		const raw = (e.currentTarget as HTMLInputElement).value;
		const parsed = raw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		updateScalar({ input_formats: parsed.length ? parsed : undefined } as Partial<ScalarFieldInput>);
	}

	function onDatetimeFastPrecision(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value;
		updateScalar({ fast_precision: value } as Partial<ScalarFieldInput>);
	}

	function onBytesInputFormat(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value;
		updateScalar({ input_format: value } as Partial<ScalarFieldInput>);
	}

	function onJsonTokenizer(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value;
		updateScalar({ tokenizer: value } as Partial<ScalarFieldInput>);
	}

	function onJsonExpandDots(e: Event) {
		const value = (e.currentTarget as HTMLInputElement).checked;
		updateScalar({ expand_dots: value } as Partial<ScalarFieldInput>);
	}

	// Top-level booleans stored/indexed/fast/inContext live on the field itself
	// (FieldCommon), so we can `bind:` them safely.
</script>

<div class="rounded-md border border-base-300">
	<button
		type="button"
		class="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-base-200/40"
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
	>
		{#if expanded}
			<ChevronDown size={14} class="opacity-60" />
		{:else}
			<ChevronRight size={14} class="opacity-60" />
		{/if}

		<span class="flex-1 truncate font-mono text-sm">
			{#if field.name}
				{field.name}
			{:else}
				<em class="opacity-50">unnamed</em>
			{/if}
		</span>

		<span class="badge badge-sm badge-ghost font-mono">
			{field.type === 'array' ? `array<${field.inner.type}>` : field.type}
		</span>

		{#if field.stored}<span class="badge badge-xs">S</span>{/if}
		{#if field.indexed}<span class="badge badge-xs">I</span>{/if}
		{#if field.fast}<span class="badge badge-xs">F</span>{/if}

		{#if field.logwizRole}
			<span class="badge badge-sm badge-primary" title={`Role: ${field.logwizRole}`}>
				{ROLE_BADGE[field.logwizRole]}
			</span>
		{/if}
		{#if field.inContext}
			<span class="size-1.5 rounded-full bg-info" title="Shown in context view"></span>
		{/if}
		{#if error}
			<span class="size-1.5 rounded-full bg-error" title={error} data-error="true"></span>
		{/if}
	</button>

	{#if expanded}
		<div class="grid grid-cols-1 gap-3 border-t border-base-300 px-3 py-3 sm:grid-cols-2">
			<label class="form-control">
				<span class="label-text text-xs">Name</span>
				<input
					type="text"
					class="input-bordered input input-sm font-mono"
					value={field.name}
					oninput={onNameInput}
					autocomplete="off"
				/>
			</label>

			{#if error}
				<span class="label-text-alt text-error sm:col-span-2" data-error="true">{error}</span>
			{/if}

			<label class="form-control">
				<span class="label-text text-xs">Type</span>
				<select
					class="select-bordered select select-sm"
					value={field.type}
					onchange={(e) => changeType(e.currentTarget.value)}
				>
					{#each SCALAR_TYPES as t (t)}
						<option value={t}>{t}</option>
					{/each}
					<option value="array">array</option>
				</select>
			</label>

			{#if field.type === 'array'}
				<label class="form-control sm:col-span-2">
					<span class="label-text text-xs">Inner type</span>
					<select
						class="select-bordered select select-sm"
						value={field.inner.type}
						onchange={(e) => changeInnerType(e.currentTarget.value)}
					>
						{#each SCALAR_TYPES as t (t)}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</label>
			{/if}

			<div class="flex items-end gap-4 sm:col-span-2">
				<label class="label cursor-pointer gap-2 text-xs">
					<input type="checkbox" class="checkbox checkbox-xs" bind:checked={field.stored} />
					Stored
				</label>
				<label class="label cursor-pointer gap-2 text-xs">
					<input type="checkbox" class="checkbox checkbox-xs" bind:checked={field.indexed} />
					Indexed
				</label>
				<label class="label cursor-pointer gap-2 text-xs">
					<input type="checkbox" class="checkbox checkbox-xs" bind:checked={field.fast} />
					Fast
				</label>
			</div>

			{#if effectiveType === 'text'}
				{@const scalar = getScalar()}
				{#if scalar && scalar.type === 'text'}
					<label class="form-control">
						<span class="label-text text-xs">Tokenizer</span>
						<select
							class="select-bordered select select-sm"
							value={scalar.tokenizer ?? 'default'}
							onchange={onTextTokenizer}
						>
							<option value="default">default</option>
							<option value="raw">raw</option>
							<option value="en_stem">en_stem</option>
							<option value="lowercase">lowercase</option>
							<option value="chinese_compatible">chinese_compatible</option>
						</select>
					</label>
					<label class="form-control">
						<span class="label-text text-xs">Record</span>
						<select
							class="select-bordered select select-sm"
							value={scalar.record ?? 'basic'}
							onchange={onTextRecord}
						>
							<option value="basic">basic</option>
							<option value="freq">freq</option>
							<option value="position">position</option>
						</select>
					</label>
					<label class="label cursor-pointer gap-2 text-xs">
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							checked={scalar.fieldnorms ?? false}
							onchange={onTextFieldnorms}
						/>
						Field norms
					</label>
				{/if}
			{/if}

			{#if effectiveType === 'datetime'}
				{@const scalar = getScalar()}
				{#if scalar && scalar.type === 'datetime'}
					<label class="form-control sm:col-span-2">
						<span class="label-text text-xs">Input formats (comma-separated)</span>
						<input
							type="text"
							class="input-bordered input input-sm"
							placeholder="rfc3339, unix_timestamp"
							value={scalar.input_formats?.join(', ') ?? ''}
							oninput={onDatetimeInputFormats}
						/>
					</label>
					<label class="form-control">
						<span class="label-text text-xs">Fast precision</span>
						<select
							class="select-bordered select select-sm"
							value={scalar.fast_precision ?? 'milliseconds'}
							onchange={onDatetimeFastPrecision}
						>
							<option value="seconds">seconds</option>
							<option value="milliseconds">milliseconds</option>
							<option value="microseconds">microseconds</option>
							<option value="nanoseconds">nanoseconds</option>
						</select>
					</label>
				{/if}
			{/if}

			{#if effectiveType === 'bytes'}
				{@const scalar = getScalar()}
				{#if scalar && scalar.type === 'bytes'}
					<label class="form-control">
						<span class="label-text text-xs">Input format</span>
						<select
							class="select-bordered select select-sm"
							value={scalar.input_format ?? 'base64'}
							onchange={onBytesInputFormat}
						>
							<option value="base64">base64</option>
							<option value="hex">hex</option>
						</select>
					</label>
				{/if}
			{/if}

			{#if effectiveType === 'json'}
				{@const scalar = getScalar()}
				{#if scalar && scalar.type === 'json'}
					<label class="form-control">
						<span class="label-text text-xs">Tokenizer</span>
						<select
							class="select-bordered select select-sm"
							value={scalar.tokenizer ?? 'default'}
							onchange={onJsonTokenizer}
						>
							<option value="default">default</option>
							<option value="raw">raw</option>
						</select>
					</label>
					<label class="label cursor-pointer gap-2 text-xs">
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							checked={scalar.expand_dots ?? false}
							onchange={onJsonExpandDots}
						/>
						Expand dots
					</label>
				{/if}
			{/if}

			<label class="form-control sm:col-span-2">
				<span class="label-text text-xs">Logwiz role</span>
				<select
					class="select-bordered select select-sm"
					value={field.logwizRole ?? ''}
					disabled={!isText}
					onchange={(e) => setRole(e.currentTarget.value)}
				>
					<option value="">none</option>
					<option value="level">Level</option>
					<option value="message">Message</option>
					<option value="traceback">Traceback</option>
				</select>
				{#if !isText}
					<span class="label-text-alt mt-1 text-xs opacity-60">
						Roles can only be assigned to text fields.
					</span>
				{/if}
			</label>

			<label class="label cursor-pointer gap-2 text-xs sm:col-span-2">
				<input type="checkbox" class="checkbox checkbox-xs" bind:checked={field.inContext} />
				Show in context view
			</label>

			<div class="flex justify-end sm:col-span-2">
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-error"
					disabled={!canDelete}
					onclick={onDelete}
				>
					<Trash2 size={12} />
					Remove field
				</button>
			</div>
		</div>
	{/if}
</div>
