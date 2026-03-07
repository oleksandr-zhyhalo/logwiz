<script lang="ts">
	import { getSources } from '$lib/sources.remote';
	import { searchLogs } from '$lib/logs.remote';
	import type { Source } from '$lib/types';
	import TimeRangeBar from './TimeRangeBar.svelte';
	import LogRow from './LogRow.svelte';

	let sources = $state<Source[]>([]);
	let selectedSourceId = $state<number | null>(null);
	let queryText = $state('');
	let timeRange = $state<'15m' | '1h' | '6h' | '24h' | '7d'>('15m');
	let logs = $state<Record<string, unknown>[]>([]);
	let numHits = $state(0);
	let loading = $state(false);
	let errorMessage = $state('');
	let hasSearched = $state(false);
	let wrapMode = $state<'none' | 'wrap' | 'pretty'>('none');

	const BATCH_SIZE = 50;

	async function loadSources() {
		sources = await getSources();
		if (sources.length > 0 && selectedSourceId === null) {
			selectedSourceId = sources[0].id;
		}
	}

	loadSources();

	async function search(append = false) {
		if (!selectedSourceId) return;

		loading = true;
		errorMessage = '';

		try {
			const result = await searchLogs({
				sourceId: selectedSourceId,
				query: queryText || '*',
				timeRange,
				offset: append ? logs.length : 0,
				limit: BATCH_SIZE
			});

			if (append) {
				logs = [...logs, ...result.hits];
			} else {
				logs = result.hits;
			}
			numHits = result.numHits;
			hasSearched = true;
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Search failed';
		} finally {
			loading = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			search();
		}
	}

	function handleTimeRangeChange(range: string) {
		timeRange = range as typeof timeRange;
		if (hasSearched) {
			search();
		}
	}

	function handleScroll(event: Event) {
		const target = event.target as HTMLElement;
		const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;
		if (nearBottom && !loading && logs.length < numHits) {
			search(true);
		}
	}

	let canLoadMore = $derived(logs.length < numHits);
</script>

<div class="flex h-full w-full flex-col">
	<!-- Controls bar -->
	<div class="border-b border-base-300 bg-base-100 px-4 py-3">
		<div class="flex w-full items-center gap-2">
			<select class="select select-bordered select-sm w-48" bind:value={selectedSourceId}>
				{#each sources as src (src.id)}
					<option value={src.id}>{src.name}</option>
				{/each}
			</select>

			<input
				type="text"
				class="input input-bordered input-sm flex-1"
				placeholder="Lucene query (e.g. level:error AND service:api)"
				bind:value={queryText}
				onkeydown={handleKeydown}
			/>

			<button
				class="btn btn-primary btn-sm"
				onclick={() => search()}
				disabled={loading || !selectedSourceId}
			>
				{loading && !logs.length ? 'Searching...' : 'Search'}
			</button>
		</div>

		<div class="mt-2 flex w-full items-center justify-between">
			<TimeRangeBar value={timeRange} onchange={handleTimeRangeChange} />
			<div class="flex items-center gap-3">
				<div class="flex gap-1">
					{#each [['none', 'No wrap'], ['wrap', 'Wrap'], ['pretty', 'Pretty']] as [mode, label] (mode)}
						<button
							class="btn btn-xs {wrapMode === mode ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => (wrapMode = mode as typeof wrapMode)}
						>
							{label}
						</button>
					{/each}
				</div>
				{#if hasSearched}
					<span class="text-xs text-base-content/50">{numHits.toLocaleString()} hits</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Log stream -->
	<div class="flex-1 overflow-y-auto bg-base-200/30 {wrapMode !== 'none' ? '' : 'overflow-x-auto'}" onscroll={handleScroll}>
		<div class="{wrapMode !== 'none' ? '' : 'w-fit min-w-full'}">
			{#if errorMessage}
				<div class="p-4">
					<div class="alert alert-error text-sm">{errorMessage}</div>
				</div>
			{:else if !hasSearched}
				<div class="flex h-full items-center justify-center">
					<p class="text-sm text-base-content/40">Select a source and run a search</p>
				</div>
			{:else if logs.length === 0}
				<div class="flex h-full items-center justify-center">
					<p class="text-sm text-base-content/40">No logs found</p>
				</div>
			{:else}
				{#each logs as hit, i (i)}
					<LogRow {hit} {wrapMode} />
				{/each}
				{#if loading}
					<div class="flex justify-center py-4">
						<span class="loading loading-spinner loading-sm"></span>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
