<script lang="ts">
	import { getSources, createSource } from '$lib/api/sources.remote';
	import { getFieldPreference, saveFieldPreference, getIndexFields } from '$lib/api/field-preferences.remote';
	import SourceCard from './SourceCard.svelte';
	import FieldPanel from '$lib/components/FieldPanel.svelte';
	import type { Source } from '$lib/types';

	let sources = $state<Source[]>([]);
	let addingNew = $state(false);
	let loaded = $state(false);

	async function loadSources() {
		sources = await getSources();
		loaded = true;
	}

	loadSources();

	function startAdd() {
		addingNew = true;
	}

	async function handleNewSave(data: Source) {
		const created = await createSource({
			name: data.name,
			url: data.url,
			indexName: data.indexName,
			levelField: data.levelField,
			timestampField: data.timestampField,
			messageField: data.messageField
		});
		sources = [created, ...sources];
		addingNew = false;
	}

	function handleNewCancel() {
		addingNew = false;
	}

	function handleSave(updated: Source) {
		sources = sources.map((s) => (s.id === updated.id ? updated : s));
	}

	function handleDelete(id: number) {
		sources = sources.filter((s) => s.id !== id);
	}

	let globalActiveFields = $state<{ id: string; name: string }[]>([]);
	let settingsIndexFields = $state<{ name: string; type: string }[]>([]);
	let settingsSourceId = $state<number | null>(null);
	let settingsFieldsLoading = $state(false);

	async function loadGlobalPreference() {
		const pref = await getFieldPreference({ sourceId: null });
		globalActiveFields = pref.fields.map((name: string) => ({ id: name, name }));
	}

	loadGlobalPreference();

	async function loadSettingsFields(sourceId: number) {
		settingsFieldsLoading = true;
		try {
			settingsIndexFields = await getIndexFields({ sourceId });
		} catch {
			settingsIndexFields = [];
		} finally {
			settingsFieldsLoading = false;
		}
	}

	function handleSettingsSourceChange(sourceId: number) {
		settingsSourceId = sourceId;
		loadSettingsFields(sourceId);
	}

	let globalSaveTimeout: ReturnType<typeof setTimeout>;
	function handleGlobalFieldsChange(fields: string[]) {
		clearTimeout(globalSaveTimeout);
		globalSaveTimeout = setTimeout(() => {
			saveFieldPreference({ sourceId: null, fields });
		}, 500);
	}
</script>

<div class="h-full overflow-y-auto">
<div class="mx-auto w-full max-w-6xl px-4 py-8">
	<section>
		<div class="flex items-center justify-between py-4">
			<div>
				<h2 class="text-xl font-semibold">Sources</h2>
				<p class="text-sm text-base-content/60">Manage your Quickwit data sources</p>
			</div>
			<button class="btn btn-accent btn-sm" onclick={startAdd} disabled={addingNew}>Add</button>
		</div>

		<div class="flex flex-col gap-3">
			{#if addingNew}
				<SourceCard
					source={{ id: 0, name: '', url: '', indexName: '', levelField: 'level', timestampField: 'timestamp', messageField: 'message', createdAt: new Date(), updatedAt: new Date() }}
					editing={true}
					isNew={true}
					onsave={(s) => handleNewSave(s)}
					oncancel={handleNewCancel}
				/>
			{/if}

			{#if !loaded}
				<p class="text-sm text-base-content/60">Loading sources...</p>
			{:else if sources.length === 0 && !addingNew}
				<p class="text-sm text-base-content/60">No sources configured yet. Add one to get started.</p>
			{:else}
				{#each sources as source (source.id)}
					<SourceCard {source} onsave={handleSave} ondelete={handleDelete} />
				{/each}
			{/if}
		</div>
	</section>

	<section class="mt-8">
		<div class="py-4">
			<h2 class="text-xl font-semibold">Default Display Fields</h2>
			<p class="text-sm text-base-content/60">
				Configure which extra fields appear in log rows by default for all sources.
				Select a source to discover available fields.
			</p>
		</div>

		<div class="card border border-base-300 bg-base-100">
			<div class="card-body p-4">
				<select
					class="select select-bordered select-sm w-48"
					value={settingsSourceId}
				onchange={(e) => handleSettingsSourceChange(Number(e.currentTarget.value))}
				>
					<option value={null} disabled selected={settingsSourceId === null}>Select source to discover fields</option>
					{#each sources as src (src.id)}
						<option value={src.id}>{src.name}</option>
					{/each}
				</select>

				{#if settingsSourceId}
					<div class="mt-3 h-64">
						<FieldPanel
							availableFields={settingsIndexFields}
							bind:activeFields={globalActiveFields}
							onchange={handleGlobalFieldsChange}
							loading={settingsFieldsLoading}
						/>
					</div>
				{/if}
			</div>
		</div>
	</section>
</div>
</div>
