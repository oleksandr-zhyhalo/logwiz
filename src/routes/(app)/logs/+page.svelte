<script lang="ts">
	import { getSources } from '$lib/sources.remote';
	import { searchLogs } from '$lib/logs.remote';
	import {
		getFieldPreference,
		saveFieldPreference,
		deleteFieldPreference,
		getIndexFields
	} from '$lib/field-preferences.remote';
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import { untrack } from 'svelte';
	import type { Source } from '$lib/types';
	import TimeRangeBar from './TimeRangeBar.svelte';
	import LogRow from './LogRow.svelte';
	import FieldPanel from './FieldPanel.svelte';

	let sources = $state<Source[]>([]);
	let selectedSourceId = $state<number | null>(null);
	let queryText = $state('');
	let timeRange = $state<'15m' | '1h' | '6h' | '24h' | '7d'>('15m');
	let logs = $state<Record<string, unknown>[]>([]);
	let numHits = $state(0);
	let loading = $state(false);
	let errorMessage = $state('');
	let hasSearched = $state(false);
	let searchStartTimestamp = $state<number | undefined>(undefined);
	let searchEndTimestamp = $state<number | undefined>(undefined);
	let wrapMode = $state<'none' | 'wrap' | 'pretty'>('none');
	let selectedSource = $derived(sources.find((s) => s.id === selectedSourceId));

	let indexFields = $state<{ name: string; type: string }[]>([]);
	let activeFields = $state<{ id: string; name: string }[]>([]);
	let hasOverride = $state(false);
	let fieldsLoading = $state(false);

	let excludedFields = $derived(
		new Set([
			selectedSource?.levelField ?? 'level',
			selectedSource?.timestampField ?? 'timestamp',
			selectedSource?.messageField ?? 'message'
		])
	);

	let panelAvailableFields = $derived(indexFields.filter((f) => !excludedFields.has(f.name)));

	let extraFieldNames = $derived(activeFields.map((f) => f.name));

	const MAX_COLUMN_CH = 60;
	let _maxRawWidths: Record<string, number> = {};
	let columnWidths = $state<Record<string, number>>({});

	function updateColumnWidths(newLogs: Record<string, unknown>[], fields: string[], reset = false) {
		if (reset) _maxRawWidths = {};

		for (const field of fields) {
			if (!(field in _maxRawWidths)) _maxRawWidths[field] = field.length;
			for (const log of newLogs) {
				const val = log[field];
				if (val !== undefined && val !== null) {
					_maxRawWidths[field] = Math.max(_maxRawWidths[field], String(val).length);
				}
			}
		}

		const widths: Record<string, number> = {};
		for (const field of fields) {
			widths[field] = Math.min((_maxRawWidths[field] ?? field.length) + 2, MAX_COLUMN_CH);
		}
		columnWidths = widths;
	}

	$effect(() => {
		const fields = extraFieldNames;
		untrack(() => {
			updateColumnWidths(logs, fields);
		});
	});

	let scrollElement = $state<HTMLDivElement | null>(null);

	const virtualizer = createVirtualizer({
		count: 0,
		getScrollElement: () => scrollElement,
		estimateSize: () => 28,
		overscan: 15
	});

	$effect(() => {
		const count = logs.length;
		const el = scrollElement;
		const mode = wrapMode;
		extraFieldNames;
		untrack(() => {
			$virtualizer.setOptions({
				count,
				getScrollElement: () => el,
				estimateSize: () => 28
			});
			$virtualizer.measure();
		});
	});

	const BATCH_SIZE = 50;

	async function loadSources() {
		sources = await getSources();
		if (sources.length > 0 && selectedSourceId === null) {
			selectedSourceId = sources[0].id;
			loadFieldsForSource(sources[0].id);
		}
	}

	loadSources();

	async function loadFieldsForSource(sourceId: number) {
		fieldsLoading = true;
		try {
			const [fields, pref] = await Promise.all([
				getIndexFields({ sourceId }),
				getFieldPreference({ sourceId })
			]);
			indexFields = fields;
			activeFields = pref.fields.map((name) => ({ id: name, name }));
			hasOverride = pref.isOverride;
		} catch {
			indexFields = [];
			activeFields = [];
		} finally {
			fieldsLoading = false;
		}
	}

	function handleSourceChange(sourceId: number) {
		selectedSourceId = sourceId;
		loadFieldsForSource(sourceId);
	}

	let saveTimeout: ReturnType<typeof setTimeout>;
	function handleFieldsChange(fields: string[]) {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			if (selectedSourceId) {
				saveFieldPreference({ sourceId: selectedSourceId, fields });
			}
		}, 500);
	}

	async function handleFieldsReset() {
		if (!selectedSourceId) return;
		await deleteFieldPreference({ sourceId: selectedSourceId });
		await loadFieldsForSource(selectedSourceId);
	}

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
				limit: BATCH_SIZE,
				startTimestamp: append ? searchStartTimestamp : undefined,
				endTimestamp: append ? searchEndTimestamp : undefined
			});

			searchStartTimestamp = result.startTimestamp;
			searchEndTimestamp = result.endTimestamp;

			if (append) {
				logs = [...logs, ...result.hits];
				updateColumnWidths(result.hits, extraFieldNames);
			} else {
				logs = result.hits;
				updateColumnWidths(result.hits, extraFieldNames, true);
				$virtualizer.scrollToIndex(0);
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

	function handleScroll() {
		const items = $virtualizer.getVirtualItems();
		const lastItem = items[items.length - 1];
		if (!lastItem) return;

		if (lastItem.index >= logs.length - 10 && !loading && logs.length < numHits) {
			search(true);
		}
	}
</script>

<div class="flex h-full w-full">
	<FieldPanel
		availableFields={panelAvailableFields}
		bind:activeFields
		onchange={handleFieldsChange}
		onreset={handleFieldsReset}
		{hasOverride}
		loading={fieldsLoading}
	/>

	<div class="flex min-w-0 flex-1 flex-col">
		<!-- Controls bar -->
		<div class="border-b border-base-300 bg-base-100 px-4 py-3">
			<div class="flex w-full items-center gap-2">
				<select
					class="select-bordered select w-48 select-sm"
					value={selectedSourceId}
					onchange={(e) => handleSourceChange(Number(e.currentTarget.value))}
				>
					{#each sources as src (src.id)}
						<option value={src.id}>{src.name}</option>
					{/each}
				</select>

				<input
					type="text"
					class="input-bordered input input-sm flex-1"
					placeholder="Lucene query (e.g. level:error AND service:api)"
					bind:value={queryText}
					onkeydown={handleKeydown}
				/>

				<button
					class="btn btn-sm btn-primary"
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
		<div
			bind:this={scrollElement}
			class="min-h-0 flex-1 overflow-auto bg-base-200/30"
			onscroll={handleScroll}
		>
			{#if errorMessage}
				<div class="p-4">
					<div class="alert text-sm alert-error">{errorMessage}</div>
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
				<div
					class="w-fit min-w-full"
					style="height: {$virtualizer.getTotalSize()}px; position: relative;"
				>
					{#each $virtualizer.getVirtualItems() as row (row.index)}
						<div
							data-index={row.index}
							use:$virtualizer.measureElement
							style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({row.start}px);"
						>
							<LogRow
								hit={logs[row.index]}
								{wrapMode}
								levelField={selectedSource?.levelField ?? 'level'}
								timestampField={selectedSource?.timestampField ?? 'timestamp'}
								messageField={selectedSource?.messageField ?? 'message'}
								extraFields={extraFieldNames}
								{columnWidths}
							/>
						</div>
					{/each}
					{#if loading}
						<div
							class="flex justify-center py-4"
							style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({$virtualizer.getTotalSize()}px);"
						>
							<span class="loading loading-sm loading-spinner"></span>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
