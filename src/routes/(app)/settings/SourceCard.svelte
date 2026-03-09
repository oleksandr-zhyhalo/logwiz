<script lang="ts">
	import Icon from '@iconify/svelte';
	import { updateSource, deleteSource, testSourceConnection } from '$lib/api/sources.remote';
	import ChipFieldSelector from '$lib/components/ChipFieldSelector.svelte';
	import {
		getPreference,
		saveDisplayFields,
		saveQuickFilterFields,
		getIndexFields
	} from '$lib/api/preferences.remote';
	import type { Source } from '$lib/types';

	let {
		source,
		editing = false,
		isNew = false,
		onsave,
		oncancel,
		ondelete
	}: {
		source: Source;
		editing?: boolean;
		isNew?: boolean;
		onsave?: (source: Source) => void | Promise<void>;
		oncancel?: () => void;
		ondelete?: (id: number) => void;
	} = $props();

	let isEditing = $state(false);
	let name = $state('');
	let url = $state('');
	let indexName = $state('');
	let levelField = $state('level');
	let timestampField = $state('timestamp');
	let messageField = $state('message');
	let initialized = false;
	let saving = $state(false);

	$effect(() => {
		if (!initialized && editing) {
			initialized = true;
			isEditing = true;
			name = source.name;
			url = source.url;
			indexName = source.indexName;
			levelField = source.levelField;
			timestampField = source.timestampField;
			messageField = source.messageField;
		}
	});
	let testing = $state(false);
	let testResult: { success: boolean; error?: string } | null = $state(null);
	let errorMessage = $state('');
	let showDeleteConfirm = $state(false);

	let displayFieldsExpanded = $state(false);
	let quickFiltersExpanded = $state(false);
	let fieldsLoaded = $state(false);
	let fieldsLoading = $state(false);
	let availableFields = $state<{ name: string; type: string }[]>([]);
	let activeDisplayFields = $state<{ id: string; name: string }[]>([]);
	let activeQuickFilterFields = $state<{ id: string; name: string }[]>([]);

	async function loadFields() {
		if (fieldsLoaded || fieldsLoading) return;
		fieldsLoading = true;
		try {
			const [fields, pref] = await Promise.all([
				getIndexFields({ sourceId: source.id }),
				getPreference({ sourceId: source.id })
			]);
			availableFields = fields;
			activeDisplayFields = pref.displayFields.map((name: string) => ({ id: name, name }));
			activeQuickFilterFields = pref.quickFilterFields.map((name: string) => ({ id: name, name }));
			fieldsLoaded = true;
		} catch {
			availableFields = [];
		} finally {
			fieldsLoading = false;
		}
	}

	function toggleDisplayFields() {
		displayFieldsExpanded = !displayFieldsExpanded;
		if (displayFieldsExpanded) loadFields();
	}

	function toggleQuickFilters() {
		quickFiltersExpanded = !quickFiltersExpanded;
		if (quickFiltersExpanded) loadFields();
	}

	let displaySaveTimeout: ReturnType<typeof setTimeout>;
	function handleDisplayFieldsChange(fields: string[]) {
		clearTimeout(displaySaveTimeout);
		displaySaveTimeout = setTimeout(() => {
			saveDisplayFields({ sourceId: source.id, fields });
		}, 500);
	}

	let quickFilterSaveTimeout: ReturnType<typeof setTimeout>;
	function handleQuickFilterFieldsChange(fields: string[]) {
		clearTimeout(quickFilterSaveTimeout);
		quickFilterSaveTimeout = setTimeout(() => {
			saveQuickFilterFields({ sourceId: source.id, fields });
		}, 500);
	}

	function startEdit() {
		name = source.name;
		url = source.url;
		indexName = source.indexName;
		levelField = source.levelField;
		timestampField = source.timestampField;
		messageField = source.messageField;
		isEditing = true;
		testResult = null;
		errorMessage = '';
	}

	function cancelEdit() {
		isEditing = false;
		testResult = null;
		errorMessage = '';
		if (isNew) {
			oncancel?.();
		}
	}

	async function save() {
		saving = true;
		errorMessage = '';
		try {
			if (isNew) {
				await onsave?.({
					...source,
					name,
					url,
					indexName,
					levelField,
					timestampField,
					messageField
				});
			} else {
				const updated = await updateSource({
					id: source.id,
					name,
					url,
					indexName,
					levelField,
					timestampField,
					messageField
				});
				onsave?.(updated);
				isEditing = false;
			}
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to save';
		} finally {
			saving = false;
		}
	}

	async function testConnection() {
		testing = true;
		testResult = null;
		try {
			testResult = await testSourceConnection({ url, indexName });
		} catch (e) {
			testResult = { success: false, error: e instanceof Error ? e.message : 'Test failed' };
		} finally {
			testing = false;
		}
	}

	async function confirmDelete() {
		try {
			await deleteSource(source.id);
			ondelete?.(source.id);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to delete';
		}
		showDeleteConfirm = false;
	}
</script>

<div class="card border border-base-300 bg-base-100">
	<div class="card-body p-4">
		{#if isEditing}
			<div class="flex flex-col gap-3">
				<label class="floating-label">
					<span>Name</span>
					<input
						type="text"
						class="input-bordered input w-full"
						placeholder="Name"
						bind:value={name}
					/>
				</label>
				<label class="floating-label">
					<span>Quickwit URL</span>
					<input
						type="url"
						class="input-bordered input w-full"
						placeholder="https://quickwit:7280/api/v1"
						bind:value={url}
					/>
				</label>
				<label class="floating-label">
					<span>Index Name</span>
					<input
						type="text"
						class="input-bordered input w-full"
						placeholder="my-index"
						bind:value={indexName}
					/>
				</label>

				<div class="divider my-1 text-xs text-base-content/40">Field Mapping</div>
				<div class="grid grid-cols-3 gap-2">
					<label class="floating-label">
						<span>Level Field</span>
						<input
							type="text"
							class="input-bordered input w-full"
							placeholder="level"
							bind:value={levelField}
						/>
					</label>
					<label class="floating-label">
						<span>Timestamp Field</span>
						<input
							type="text"
							class="input-bordered input w-full"
							placeholder="timestamp"
							bind:value={timestampField}
						/>
					</label>
					<label class="floating-label">
						<span>Message Field</span>
						<input
							type="text"
							class="input-bordered input w-full"
							placeholder="message"
							bind:value={messageField}
						/>
					</label>
				</div>

				{#if testResult}
					<div class="alert {testResult.success ? 'alert-success' : 'alert-error'} text-sm">
						{testResult.success ? 'Connection successful!' : testResult.error}
					</div>
				{/if}

				{#if errorMessage}
					<div class="alert text-sm alert-error">{errorMessage}</div>
				{/if}

				<div class="flex justify-end gap-2">
					<button
						class="btn btn-ghost btn-sm"
						onclick={testConnection}
						disabled={testing || !url || !indexName}
					>
						{testing ? 'Testing...' : 'Test Connection'}
					</button>
					<button class="btn btn-ghost btn-sm" onclick={cancelEdit}>Cancel</button>
					<button
						class="btn btn-sm btn-primary"
						onclick={save}
						disabled={saving || !name || !url || !indexName}
					>
						{saving ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>
		{:else}
			<div class="flex items-center justify-between">
				<div>
					<h3 class="font-bold">{source.name}</h3>
					<p class="text-sm text-base-content/60">{source.url} &mdash; {source.indexName}</p>
				</div>
				<div class="flex gap-1">
					<button class="btn btn-ghost btn-sm" onclick={startEdit}>
						<Icon icon="lucide:pencil" width="16" height="16" />
					</button>
					<button
						class="btn text-error btn-ghost btn-sm"
						onclick={() => (showDeleteConfirm = true)}
					>
						<Icon icon="lucide:trash-2" width="16" height="16" />
					</button>
				</div>
			</div>

			<!-- Display Fields -->
			<div class="mt-2 border-t border-base-300 pt-2">
				<button class="flex w-full items-center gap-1 text-left" onclick={toggleDisplayFields}>
					<Icon
						icon={displayFieldsExpanded ? 'lucide:chevron-down' : 'lucide:chevron-right'}
						width="14"
						height="14"
						class="text-base-content/40"
					/>
					<span class="text-xs font-semibold tracking-wider text-base-content/60 uppercase"
						>Display Fields</span
					>
					{#if activeDisplayFields.length > 0 && !displayFieldsExpanded}
						<span class="ml-1 badge badge-ghost badge-xs">{activeDisplayFields.length}</span>
					{/if}
				</button>
				{#if displayFieldsExpanded}
					<div class="mt-2 pl-5">
						<ChipFieldSelector
							{availableFields}
							bind:activeFields={activeDisplayFields}
							onchange={handleDisplayFieldsChange}
							loading={fieldsLoading}
						/>
					</div>
				{/if}
			</div>

			<!-- Quick Filters -->
			<div class="border-t border-base-300 pt-2">
				<button class="flex w-full items-center gap-1 text-left" onclick={toggleQuickFilters}>
					<Icon
						icon={quickFiltersExpanded ? 'lucide:chevron-down' : 'lucide:chevron-right'}
						width="14"
						height="14"
						class="text-base-content/40"
					/>
					<span class="text-xs font-semibold tracking-wider text-base-content/60 uppercase"
						>Quick Filters</span
					>
					{#if activeQuickFilterFields.length > 0 && !quickFiltersExpanded}
						<span class="ml-1 badge badge-ghost badge-xs">{activeQuickFilterFields.length}</span>
					{/if}
				</button>
				{#if quickFiltersExpanded}
					<div class="mt-2 pl-5">
						<ChipFieldSelector
							{availableFields}
							bind:activeFields={activeQuickFilterFields}
							onchange={handleQuickFilterFieldsChange}
							loading={fieldsLoading}
						/>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if showDeleteConfirm}
	<dialog class="modal-open modal">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Source</h3>
			<p class="py-4">Are you sure you want to delete "{source.name}"?</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
				<button class="btn btn-error" onclick={confirmDelete}>Delete</button>
			</div>
		</div>
		<button class="modal-backdrop" onclick={() => (showDeleteConfirm = false)}>close</button>
	</dialog>
{/if}
