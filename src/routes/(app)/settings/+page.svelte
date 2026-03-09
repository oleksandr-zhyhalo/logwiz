<script lang="ts">
	import { getSources, createSource } from '$lib/api/sources.remote';
	import SourceCard from './SourceCard.svelte';
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
</script>

<div class="h-full overflow-y-auto">
	<div class="mx-auto w-full max-w-6xl px-4 py-8">
		<section>
			<div class="flex items-center justify-between py-4">
				<div>
					<h2 class="text-xl font-semibold">Sources</h2>
					<p class="text-sm text-base-content/60">Manage your Quickwit data sources</p>
				</div>
				<button class="btn btn-sm btn-accent" onclick={startAdd} disabled={addingNew}>Add</button>
			</div>

			<div class="flex flex-col gap-3">
				{#if addingNew}
					<SourceCard
						source={{
							id: 0,
							name: '',
							url: '',
							indexName: '',
							levelField: 'level',
							timestampField: 'timestamp',
							messageField: 'message',
							createdAt: new Date(),
							updatedAt: new Date()
						}}
						editing={true}
						isNew={true}
						onsave={(s) => handleNewSave(s)}
						oncancel={handleNewCancel}
					/>
				{/if}

				{#if !loaded}
					<p class="text-sm text-base-content/60">Loading sources...</p>
				{:else if sources.length === 0 && !addingNew}
					<p class="text-sm text-base-content/60">
						No sources configured yet. Add one to get started.
					</p>
				{:else}
					{#each sources as source (source.id)}
						<SourceCard {source} onsave={handleSave} ondelete={handleDelete} />
					{/each}
				{/if}
			</div>
		</section>
	</div>
</div>
