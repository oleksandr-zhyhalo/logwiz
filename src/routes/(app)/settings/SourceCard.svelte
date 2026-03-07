<script lang="ts">
	import Icon from '@iconify/svelte';
	import {
		updateSource,
		deleteSource,
		testSourceConnection
	} from '$lib/sources.remote';
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
				await onsave?.({ ...source, name, url, indexName, levelField, timestampField, messageField });
			} else {
				const updated = await updateSource({ id: source.id, name, url, indexName, levelField, timestampField, messageField });
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
					<input type="text" class="input input-bordered w-full" placeholder="Name" bind:value={name} />
				</label>
				<label class="floating-label">
					<span>Quickwit URL</span>
					<input type="url" class="input input-bordered w-full" placeholder="https://quickwit:7280/api/v1" bind:value={url} />
				</label>
				<label class="floating-label">
					<span>Index Name</span>
					<input type="text" class="input input-bordered w-full" placeholder="my-index" bind:value={indexName} />
				</label>

				<div class="divider my-1 text-xs text-base-content/40">Field Mapping</div>
				<div class="grid grid-cols-3 gap-2">
					<label class="floating-label">
						<span>Level Field</span>
						<input type="text" class="input input-bordered w-full" placeholder="level" bind:value={levelField} />
					</label>
					<label class="floating-label">
						<span>Timestamp Field</span>
						<input type="text" class="input input-bordered w-full" placeholder="timestamp" bind:value={timestampField} />
					</label>
					<label class="floating-label">
						<span>Message Field</span>
						<input type="text" class="input input-bordered w-full" placeholder="message" bind:value={messageField} />
					</label>
				</div>

				{#if testResult}
					<div class="alert {testResult.success ? 'alert-success' : 'alert-error'} text-sm">
						{testResult.success ? 'Connection successful!' : testResult.error}
					</div>
				{/if}

				{#if errorMessage}
					<div class="alert alert-error text-sm">{errorMessage}</div>
				{/if}

				<div class="flex gap-2 justify-end">
					<button class="btn btn-sm btn-ghost" onclick={testConnection} disabled={testing || !url || !indexName}>
						{testing ? 'Testing...' : 'Test Connection'}
					</button>
					<button class="btn btn-sm btn-ghost" onclick={cancelEdit}>Cancel</button>
					<button class="btn btn-sm btn-primary" onclick={save} disabled={saving || !name || !url || !indexName}>
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
					<button class="btn btn-sm btn-ghost" onclick={startEdit}>
						<Icon icon="lucide:pencil" width="16" height="16" />
					</button>
					<button class="btn btn-sm btn-ghost text-error" onclick={() => (showDeleteConfirm = true)}>
						<Icon icon="lucide:trash-2" width="16" height="16" />
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

{#if showDeleteConfirm}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Delete Source</h3>
			<p class="py-4">Are you sure you want to delete "{source.name}"?</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
				<button class="btn btn-error" onclick={confirmDelete}>Delete</button>
			</div>
		</div>
		<button class="modal-backdrop" onclick={() => (showDeleteConfirm = false)}>close</button>
	</dialog>
{/if}
