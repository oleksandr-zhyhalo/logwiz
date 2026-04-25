<script lang="ts">
	import { ChevronRight, EyeOff, Globe, ShieldUser } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { goto } from '$app/navigation';
	import { createIndex } from '$lib/api/indexes.remote';
	import CreateIndexFieldRow from '$lib/components/admin/CreateIndexFieldRow.svelte';
	import { createIndexSchema } from '$lib/schemas/index-create';
	import type { CreateIndexInput, FieldMappingInput, LogwizFieldRole } from '$lib/types';
	import { getErrorMessage } from '$lib/utils/error';

	let indexId = $state('');
	let displayName = $state('');
	let mode = $state<'dynamic' | 'lenient' | 'strict'>('dynamic');
	let visibility = $state<'hidden' | 'admin' | 'all'>('admin');

	let fieldMappings = $state<FieldMappingInput[]>([
		{
			name: 'timestamp',
			type: 'datetime',
			stored: true,
			indexed: true,
			fast: true,
			fast_precision: 'milliseconds'
		}
	]);
	let expandedRows = $state<boolean[]>([true]);

	let timestampField = $state('timestamp');
	let defaultSearchFields = $state<string[]>([]);
	let defaultSearchInput = $state('');

	let retentionPeriod = $state('');
	let retentionSchedule = $state<'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
	let commitTimeoutSecs = $state(60);

	let submitting = $state(false);
	let errors = $state<Record<string, string>>({});
	let advancedOpen = $state(false);
	const advancedHasError = $derived(
		!!errors.commitTimeoutSecs || Object.keys(errors).some((k) => k.startsWith('retention'))
	);

	function effectiveType(f: FieldMappingInput) {
		return f.type === 'array' ? f.inner.type : f.type;
	}

	const datetimeFastFields = $derived(
		fieldMappings
			.filter((f) => effectiveType(f) === 'datetime' && f.fast)
			.map((f) => f.name)
			.filter((n) => n.length > 0)
	);

	const searchableFields = $derived(
		fieldMappings
			.filter((f) => {
				const t = effectiveType(f);
				return t === 'text' || t === 'json';
			})
			.map((f) => f.name)
			.filter((n) => n.length > 0)
	);

	const availableSearchFields = $derived(
		searchableFields.filter((n) => !defaultSearchFields.includes(n))
	);

	$effect(() => {
		if (datetimeFastFields.length === 1 && timestampField !== datetimeFastFields[0]) {
			timestampField = datetimeFastFields[0];
		}
		if (timestampField && !datetimeFastFields.includes(timestampField)) {
			timestampField = '';
		}
	});

	function addField() {
		fieldMappings = [
			...fieldMappings,
			{
				name: '',
				type: 'text',
				stored: true,
				indexed: true,
				fast: false,
				tokenizer: 'default',
				record: 'basic'
			}
		];
		expandedRows = [...expandedRows, true];
	}

	function removeField(idx: number) {
		fieldMappings = fieldMappings.filter((_, i) => i !== idx);
		expandedRows = expandedRows.filter((_, i) => i !== idx);
	}

	function assignRole(idx: number, role: LogwizFieldRole | null) {
		fieldMappings = fieldMappings.map((f, i) => {
			if (i === idx) return { ...f, logwizRole: role ?? undefined };
			if (role && f.logwizRole === role) return { ...f, logwizRole: undefined };
			return f;
		});
	}

	function addSearchField() {
		const trimmed = defaultSearchInput.trim();
		if (!trimmed) return;
		if (!defaultSearchFields.includes(trimmed)) {
			defaultSearchFields = [...defaultSearchFields, trimmed];
		}
		defaultSearchInput = '';
	}

	function removeSearchField(name: string) {
		defaultSearchFields = defaultSearchFields.filter((n) => n !== name);
	}

	function buildPayload(): CreateIndexInput {
		const payload: CreateIndexInput = {
			indexId: indexId.trim(),
			mode,
			fieldMappings,
			timestampField,
			defaultSearchFields,
			commitTimeoutSecs,
			displayName: displayName.trim() || undefined,
			visibility
		};
		if (retentionPeriod.trim()) {
			payload.retention = {
				period: retentionPeriod.trim(),
				schedule: retentionSchedule
			};
		}
		return payload;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		errors = {};

		const payload = buildPayload();
		const parsed = v.safeParse(createIndexSchema, payload);
		if (!parsed.success) {
			const map: Record<string, string> = {};
			for (const issue of parsed.issues) {
				const path = issue.path?.map((p) => String(p.key)).join('.') ?? '_form';
				if (!map[path]) map[path] = issue.message;
			}
			errors = map;
			expandedRows = expandedRows.map((wasOpen, idx) => wasOpen || rowError(idx) !== undefined);
			if (advancedHasError) advancedOpen = true;
			scrollToFirstError();
			return;
		}

		submitting = true;
		try {
			const result = await createIndex(parsed.output);
			toast.success(`Index ${result.indexId} created`);
			await goto(`/administration/indexes/${encodeURIComponent(result.indexId)}`);
		} catch (err) {
			toast.error(getErrorMessage(err, 'Failed to create index'));
		} finally {
			submitting = false;
		}
	}

	function scrollToFirstError() {
		queueMicrotask(() => {
			const node = document.querySelector('input[data-error="true"], select[data-error="true"]');
			if (node && 'scrollIntoView' in node) {
				(node as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
				if (node instanceof HTMLElement) node.focus({ preventScroll: true });
			}
		});
	}

	function fieldErrorAt(prefix: string): string | undefined {
		const exact = errors[prefix];
		if (exact) return exact;
		const child = Object.entries(errors).find(([k]) => k.startsWith(`${prefix}.`));
		return child?.[1];
	}

	function rowError(idx: number): string | undefined {
		const exact = errors[`fieldMappings.${idx}`];
		if (exact) return exact;
		const child = Object.entries(errors).find(([k]) => k.startsWith(`fieldMappings.${idx}.`));
		return child?.[1];
	}

	const modeOptions: { value: typeof mode; label: string; description: string }[] = [
		{
			value: 'dynamic',
			label: 'Dynamic',
			description: 'Accept and index any field. Recommended for most apps.'
		},
		{
			value: 'lenient',
			label: 'Lenient',
			description: 'Silently drop fields that aren’t declared in the schema.'
		},
		{
			value: 'strict',
			label: 'Strict',
			description: 'Reject documents that contain undeclared fields.'
		}
	];

	const visibilityOptions: {
		value: typeof visibility;
		label: string;
		description: string;
		icon: typeof Globe;
	}[] = [
		{
			value: 'all',
			label: 'Public',
			description: 'All members can search this index.',
			icon: Globe
		},
		{
			value: 'admin',
			label: 'Admins only',
			description: 'Only admins can see and search.',
			icon: ShieldUser
		},
		{
			value: 'hidden',
			label: 'Hidden',
			description: 'Used for ingestion only — not shown in search.',
			icon: EyeOff
		}
	];
</script>

<div class="mx-auto flex max-w-4xl flex-col gap-6">
	<header class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold">Create index</h1>
			<p class="mt-1 text-sm text-base-content/60">
				Define the schema, retention, and visibility for a new Quickwit index.
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<a href="/administration/indexes" class="btn btn-sm">Cancel</a>
			<button
				type="submit"
				form="create-index-form"
				class="btn btn-sm btn-accent"
				disabled={submitting}
			>
				{submitting ? 'Creating…' : 'Create index'}
			</button>
		</div>
	</header>

	<form id="create-index-form" class="flex flex-col gap-6" onsubmit={handleSubmit}>
		<!-- Basics -->
		<section class="rounded-box border border-base-300 bg-base-100">
			<div class="border-b border-base-300 px-4 py-3">
				<h2 class="text-sm font-semibold">Basics</h2>
				<p class="mt-0.5 text-xs text-base-content/60">
					Identity and presentation. The ID can’t be changed once the index is created.
				</p>
			</div>

			<div class="grid grid-cols-[260px_1fr] gap-6 border-b border-base-300 px-4 py-4">
				<div>
					<label for="indexId" class="text-sm font-medium">Index ID</label>
					<div class="mt-0.5 text-xs text-base-content/60">
						Used in the URL and ingestion endpoint. Letters, digits, <code>_</code> and
						<code>-</code>; must start with a letter.
					</div>
				</div>
				<div>
					<input
						id="indexId"
						type="text"
						class="input-bordered input input-sm w-full font-mono"
						bind:value={indexId}
						autocomplete="off"
						required
						placeholder="e.g. app-logs-prod"
						data-error={errors.indexId ? 'true' : undefined}
						aria-invalid={errors.indexId ? 'true' : undefined}
						aria-describedby={errors.indexId ? 'indexId-error' : undefined}
					/>
					{#if errors.indexId}
						<div id="indexId-error" class="mt-1 text-xs text-error">{errors.indexId}</div>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
				<div>
					<label for="displayName" class="text-sm font-medium">Display name</label>
					<div class="mt-0.5 text-xs text-base-content/60">
						Friendly label shown to users. Optional.
					</div>
				</div>
				<div>
					<input
						id="displayName"
						type="text"
						class="input-bordered input input-sm w-full"
						bind:value={displayName}
						placeholder="e.g. Production App Logs"
					/>
				</div>
			</div>
		</section>

		<!-- Fields -->
		<section class="rounded-box border border-base-300 bg-base-100">
			<div class="flex items-start justify-between gap-4 border-b border-base-300 px-4 py-3">
				<div>
					<h2 class="text-sm font-semibold">Fields</h2>
					<p class="mt-0.5 text-xs text-base-content/60">
						Declare each field’s name, type, and how it’s indexed. Click a row to edit
						type-specific options and assign Logwiz roles. Add at least one
						<code>datetime</code> field with <em>fast</em> enabled to use as the timestamp.
					</p>
				</div>
				<button type="button" class="btn btn-sm shrink-0" onclick={addField}>
					+ Add field
				</button>
			</div>

			<div class="flex flex-col gap-2 px-4 py-4">
				{#if fieldErrorAt('fieldMappings')}
					<div class="alert alert-warning text-xs">
						{fieldErrorAt('fieldMappings')}
					</div>
				{/if}

				{#each fieldMappings as _field, idx (idx)}
					<CreateIndexFieldRow
						bind:field={fieldMappings[idx]}
						bind:expanded={expandedRows[idx]}
						canDelete={fieldMappings.length > 1}
						onDelete={() => removeField(idx)}
						assignRole={(role) => assignRole(idx, role)}
						error={rowError(idx)}
					/>
				{/each}
			</div>
		</section>

		<!-- Schema -->
		<section class="rounded-box border border-base-300 bg-base-100">
			<div class="border-b border-base-300 px-4 py-3">
				<h2 class="text-sm font-semibold">Schema</h2>
				<p class="mt-0.5 text-xs text-base-content/60">
					How the index handles unmapped fields and what to search by default.
				</p>
			</div>

			<div class="grid grid-cols-[260px_1fr] gap-6 border-b border-base-300 px-4 py-4">
				<div>
					<div class="text-sm font-medium">Mapping mode</div>
					<div class="mt-0.5 text-xs text-base-content/60">
						Controls what happens to fields that aren’t declared above.
					</div>
				</div>
				<div class="flex flex-col gap-2">
					{#each modeOptions as opt (opt.value)}
						<label
							class="flex cursor-pointer items-start justify-between gap-3 rounded-md border-2 border-base-300 bg-base-100 p-3 hover:border-base-content/20 has-[input:checked]:border-primary"
						>
							<div class="min-w-0">
								<div class="text-sm font-medium">{opt.label}</div>
								<div class="mt-0.5 text-xs text-base-content/60">{opt.description}</div>
							</div>
							<input
								type="radio"
								class="radio radio-sm mt-0.5"
								name="mode"
								value={opt.value}
								bind:group={mode}
							/>
						</label>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-[260px_1fr] gap-6 border-b border-base-300 px-4 py-4">
				<div>
					<label for="timestampField" class="text-sm font-medium">Timestamp field</label>
					<div class="mt-0.5 text-xs text-base-content/60">
						Quickwit partitions splits by this field. Required, and the field must be
						<code>datetime</code> with <em>fast</em> enabled.
					</div>
				</div>
				<div>
					<select
						id="timestampField"
						class="select-bordered select select-sm w-full"
						bind:value={timestampField}
						data-error={errors.timestampField ? 'true' : undefined}
						aria-invalid={errors.timestampField ? 'true' : undefined}
						aria-describedby={errors.timestampField ? 'timestampField-error' : undefined}
						disabled={datetimeFastFields.length === 0}
					>
						{#if datetimeFastFields.length === 0}
							<option value="">No fast datetime field — add one in Fields</option>
						{:else}
							{#each datetimeFastFields as name (name)}
								<option value={name}>{name}</option>
							{/each}
						{/if}
					</select>
					{#if errors.timestampField}
						<div id="timestampField-error" class="mt-1 text-xs text-error">
							{errors.timestampField}
						</div>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
				<div>
					<div class="text-sm font-medium">Default search fields</div>
					<div class="mt-0.5 text-xs text-base-content/60">
						Fields searched when a query doesn’t name one. Pick <code>text</code> or
						<code>json</code> fields.
					</div>
				</div>
				<div>
					{#if defaultSearchFields.length > 0}
						<div class="mb-2 flex flex-wrap gap-1.5">
							{#each defaultSearchFields as name (name)}
								<span class="badge gap-1 badge-ghost font-mono text-xs badge-sm">
									{name}
									<button
										type="button"
										aria-label="Remove {name}"
										class="cursor-pointer text-error"
										onclick={() => removeSearchField(name)}>&times;</button
									>
								</span>
							{/each}
						</div>
					{/if}
					<div class="flex gap-2">
						<select
							class="select-bordered select select-sm flex-1"
							bind:value={defaultSearchInput}
							disabled={availableSearchFields.length === 0}
						>
							<option value=""
								>{availableSearchFields.length === 0
									? 'No more text/json fields available'
									: 'Pick a text or json field…'}</option
							>
							{#each availableSearchFields as name (name)}
								<option value={name}>{name}</option>
							{/each}
						</select>
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							onclick={addSearchField}
							disabled={!defaultSearchInput}
						>
							Add
						</button>
					</div>
				</div>
			</div>
		</section>

		<!-- Advanced (retention, visibility, indexing tuning) -->
		<details
			class="group rounded-box border border-base-300 bg-base-100"
			bind:open={advancedOpen}
		>
			<summary class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
				<div>
					<div class="text-sm font-semibold">Advanced</div>
					<div class="mt-0.5 text-xs text-base-content/60">
						Retention, visibility, and indexing tuning. Defaults are usually fine.
					</div>
				</div>
				<ChevronRight
					size={16}
					class="opacity-60 transition-transform group-open:rotate-90"
				/>
			</summary>

			<div class="grid grid-cols-[260px_1fr] gap-6 border-t border-base-300 px-4 py-4">
				<div>
					<label for="retentionPeriod" class="text-sm font-medium">Retention</label>
					<div class="mt-0.5 text-xs text-base-content/60">
						Splits older than this are deleted. Leave empty to keep forever. Cleanup runs on the
						schedule below.
					</div>
				</div>
				<div>
					<div class="flex gap-2">
						<input
							id="retentionPeriod"
							type="text"
							class="input-bordered input input-sm flex-1"
							bind:value={retentionPeriod}
							placeholder="e.g. 30 days"
							data-error={errors['retention.period'] ? 'true' : undefined}
							aria-invalid={errors['retention.period'] ? 'true' : undefined}
						/>
						<select
							class="select-bordered select select-sm w-32"
							bind:value={retentionSchedule}
							aria-label="Retention cleanup schedule"
						>
							<option value="hourly">Hourly</option>
							<option value="daily">Daily</option>
							<option value="weekly">Weekly</option>
							<option value="monthly">Monthly</option>
							<option value="yearly">Yearly</option>
						</select>
					</div>
					{#if errors['retention.period']}
						<div class="mt-1 text-xs text-error">{errors['retention.period']}</div>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-[260px_1fr] gap-6 border-t border-base-300 px-4 py-4">
				<div>
					<div class="text-sm font-medium">Search visibility</div>
					<div class="mt-0.5 text-xs text-base-content/60">
						Who can see this index on the search page.
					</div>
				</div>
				<div class="flex flex-col gap-2">
					{#each visibilityOptions as opt (opt.value)}
						{@const Icon = opt.icon}
						<label
							class="flex cursor-pointer items-start justify-between gap-3 rounded-md border-2 border-base-300 bg-base-100 p-3 hover:border-base-content/20 has-[input:checked]:border-primary"
						>
							<div class="flex min-w-0 items-start gap-2.5">
								<Icon size={16} class="mt-0.5 opacity-70" />
								<div class="min-w-0">
									<div class="text-sm font-medium">{opt.label}</div>
									<div class="mt-0.5 text-xs text-base-content/60">{opt.description}</div>
								</div>
							</div>
							<input
								type="radio"
								class="radio radio-sm mt-0.5"
								name="visibility"
								value={opt.value}
								bind:group={visibility}
							/>
						</label>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-[260px_1fr] gap-6 border-t border-base-300 px-4 py-4">
				<div>
					<label for="commitTimeoutSecs" class="text-sm font-medium">Commit timeout</label>
					<div class="mt-0.5 text-xs text-base-content/60">
						Maximum seconds a document can sit in the indexer queue before a commit is forced.
						Lower means faster searchability, more splits.
					</div>
				</div>
				<div>
					<label class="input-bordered input input-sm flex w-full max-w-xs items-center gap-2">
						<input
							id="commitTimeoutSecs"
							type="number"
							class="grow"
							min="1"
							value={commitTimeoutSecs}
							oninput={(e) => {
								const n = e.currentTarget.valueAsNumber;
								commitTimeoutSecs = Number.isFinite(n) ? n : 60;
							}}
							data-error={errors.commitTimeoutSecs ? 'true' : undefined}
							aria-invalid={errors.commitTimeoutSecs ? 'true' : undefined}
						/>
						<span class="text-xs text-base-content/60">seconds</span>
					</label>
					{#if errors.commitTimeoutSecs}
						<div class="mt-1 text-xs text-error">{errors.commitTimeoutSecs}</div>
					{/if}
				</div>
			</div>
		</details>

		<div class="flex items-center justify-end gap-2">
			<a href="/administration/indexes" class="btn btn-sm">Cancel</a>
			<button type="submit" class="btn btn-sm btn-accent" disabled={submitting}>
				{submitting ? 'Creating…' : 'Create index'}
			</button>
		</div>
	</form>
</div>
