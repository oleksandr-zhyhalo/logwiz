<script lang="ts">
	import { getIndexes } from '$lib/api/indexes.remote';
	import IndexConfigCard from './IndexConfigCard.svelte';

	let indexes = $state<{ indexId: string; indexUri: string }[]>([]);
	let loaded = $state(false);
	let errorMessage = $state('');

	async function loadIndexes() {
		try {
			indexes = await getIndexes();
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to load indexes';
		} finally {
			loaded = true;
		}
	}

	loadIndexes();
</script>

<div class="h-full overflow-y-auto">
	<div class="mx-auto w-full max-w-6xl px-4 py-8">
		<section>
			<div class="py-4">
				<h2 class="text-xl font-semibold">Index Field Mappings</h2>
				<p class="text-sm text-base-content/60">
					Override default field names (level, timestamp, message) per index
				</p>
			</div>

			{#if !loaded}
				<div class="flex justify-center py-8">
					<span class="loading loading-sm loading-spinner"></span>
				</div>
			{:else if errorMessage}
				<div class="alert text-sm alert-error">{errorMessage}</div>
			{:else if indexes.length === 0}
				<p class="text-sm text-base-content/60">
					No indexes found. Check that QUICKWIT_URL is configured correctly.
				</p>
			{:else}
				<div class="flex flex-col gap-1">
					{#each indexes as idx (idx.indexId)}
						<IndexConfigCard indexId={idx.indexId} />
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>
