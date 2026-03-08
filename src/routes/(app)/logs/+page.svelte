<script lang="ts">
	import { getSources } from '$lib/api/sources.remote';
	import { searchLogs, searchFieldValues } from '$lib/api/logs.remote';
	import {
		getPreference,
		saveDisplayFields,
		saveQuickFilterFields,
		getIndexFields
	} from '$lib/api/preferences.remote';
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { getNestedValue, formatFieldValue, combineQueryWithFilters } from '$lib/utils';
	import type { Source, TimeRange, TimezoneMode } from '$lib/types';
	import TimeRangePicker from '$lib/components/TimeRangePicker.svelte';
	import { resolveTimeRange } from '$lib/utils';
	import LogRow from './LogRow.svelte';
	import FieldPanel from '$lib/components/FieldPanel.svelte';
	import QuickFilterPanel from '$lib/components/QuickFilterPanel.svelte';

	let sources = $state<Source[]>([]);
	let selectedSourceId = $state<number | null>(null);
	let baseQuery = $state('');
	let timeRange = $state<TimeRange>({ type: 'relative', preset: '15m' });
	let timezoneMode = $state<TimezoneMode>('local');
	let quickFilterFields = $state<string[]>([]);
	let activeFilters = $state<Record<string, string[]>>({});
	let aggregations = $state<Record<string, string[]>>({});
	let queryText = $derived(combineQueryWithFilters(baseQuery, activeFilters));
	let logs = $state<Record<string, unknown>[]>([]);
	let numHits = $state(0);
	let loading = $state(false);
	let errorMessage = $state('');
	let hasSearched = $state(false);
	let searchStartTimestamp = $state<number | undefined>(undefined);
	let searchEndTimestamp = $state<number | undefined>(undefined);
	let wrapMode = $state<'none' | 'wrap' | 'pretty'>('none');
	let selectedSource = $derived(sources.find((s) => s.id === selectedSourceId));

	let indexFields = $state<{ name: string; type: string; fast: boolean }[]>([]);
	let activeFields = $state<{ id: string; name: string }[]>([]);
	let fieldsLoading = $state(false);

	let excludedFields = $derived(
		new Set([
			selectedSource?.levelField ?? 'level',
			selectedSource?.timestampField ?? 'timestamp',
			selectedSource?.messageField ?? 'message'
		])
	);

	let panelAvailableFields = $derived(indexFields.filter((f) => !excludedFields.has(f.name)));
	let quickFilterAvailableFields = $derived(panelAvailableFields.filter((f) => f.fast));

	let extraFieldNames = $derived(activeFields.map((f) => f.name));

	const MAX_COLUMN_CH = 60;
	let _maxRawWidths: Record<string, number> = {};
	let columnWidths = $state<Record<string, number>>({});

	function updateColumnWidths(newLogs: Record<string, unknown>[], fields: string[], reset = false) {
		if (reset) _maxRawWidths = {};

		for (const field of fields) {
			if (!(field in _maxRawWidths)) _maxRawWidths[field] = 0;
			for (const log of newLogs) {
				const val = getNestedValue(log, field);
				if (val !== undefined && val !== null) {
					_maxRawWidths[field] = Math.max(_maxRawWidths[field], formatFieldValue(val).length);
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
			updateColumnWidths(logs, fields, true);
		});
	});

	let scrollElement = $state<HTMLDivElement | null>(null);

	const BATCH_SIZE = 50;

	async function loadSources() {
		sources = await getSources();
		if (sources.length > 0 && selectedSourceId === null) {
			const saved = browser ? localStorage.getItem('selectedSourceId') : null;
			const savedId = saved ? Number(saved) : null;
			const id = savedId && sources.some((s) => s.id === savedId) ? savedId : sources[0].id;
			selectedSourceId = id;
			loadFieldsForSource(id);
		}
	}

	loadSources();

	async function loadFieldsForSource(sourceId: number) {
		fieldsLoading = true;
		try {
			const [fields, pref] = await Promise.all([
				getIndexFields({ sourceId }),
				getPreference({ sourceId })
			]);
			indexFields = fields;
			activeFields = pref.displayFields.map((name) => ({ id: name, name }));

			// Load quick filter fields; default to source's levelField
			quickFilterFields = pref.quickFilterFields.length > 0
				? pref.quickFilterFields
				: [selectedSource?.levelField ?? 'level'];
			search();
		} catch {
			indexFields = [];
			activeFields = [];
			quickFilterFields = [];
		} finally {
			fieldsLoading = false;
		}
	}

	function handleSourceChange(sourceId: number) {
		selectedSourceId = sourceId;
		localStorage.setItem('selectedSourceId', String(sourceId));
		activeFilters = {};
		aggregations = {};
		loadFieldsForSource(sourceId);
	}

	let saveTimeout: ReturnType<typeof setTimeout>;
	function handleFieldsChange(fields: string[]) {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			if (selectedSourceId) {
				saveDisplayFields({ sourceId: selectedSourceId, fields });
			}
		}, 500);
	}

	let quickFilterSaveTimeout: ReturnType<typeof setTimeout>;
	function handleQuickFilterFieldsChange(fields: string[]) {
		quickFilterFields = fields;
		// Clean aggregations/activeFilters for removed fields
		const fieldSet = new Set(fields);
		aggregations = Object.fromEntries(
			Object.entries(aggregations).filter(([k]) => fieldSet.has(k))
		);
		const cleanedFilters = Object.fromEntries(
			Object.entries(activeFilters).filter(([k]) => fieldSet.has(k))
		);
		if (JSON.stringify(cleanedFilters) !== JSON.stringify(activeFilters)) {
			activeFilters = cleanedFilters;
		}
		clearTimeout(quickFilterSaveTimeout);
		quickFilterSaveTimeout = setTimeout(() => {
			if (selectedSourceId) {
				saveQuickFilterFields({ sourceId: selectedSourceId, fields });
			}
			if (hasSearched) search();
		}, 500);
	}

	async function search(append = false) {
		if (!selectedSourceId) return;

		loading = true;
		errorMessage = '';

		try {
			const resolved = resolveTimeRange(timeRange);
			const result = await searchLogs({
				sourceId: selectedSourceId,
				query: queryText || '*',
				timeRange: (timeRange.type === 'relative' ? timeRange.preset : '15m') as '15m',
				offset: append ? logs.length : 0,
				limit: BATCH_SIZE,
				startTimestamp: append ? searchStartTimestamp : resolved.startTs,
				endTimestamp: append ? searchEndTimestamp : resolved.endTs,
				quickFilterFields
			});

			searchStartTimestamp = result.startTimestamp;
			searchEndTimestamp = result.endTimestamp;

			// Update aggregations only from unfiltered searches so filter
			// values don't disappear when the user narrows results
			if (!append && result.aggregations) {
				const hasActiveFilters = Object.keys(activeFilters).length > 0;
				if (!hasActiveFilters) {
					aggregations = result.aggregations;
				} else {
					// Merge in aggregations for new fields without overwriting existing
					const merged = { ...aggregations };
					for (const [field, values] of Object.entries(result.aggregations)) {
						if (!(field in merged)) {
							merged[field] = values;
						}
					}
					aggregations = merged;
				}
			}

			if (append) {
				logs = [...logs, ...result.hits];
				updateColumnWidths(result.hits, extraFieldNames);
			} else {
				logs = result.hits;
				updateColumnWidths(result.hits, extraFieldNames, true);
				scrollElement?.scrollTo(0, 0);
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

	function handleTimeRangeChange(range: TimeRange) {
		timeRange = range;
		if (hasSearched) {
			search();
		}
	}

	function handleFilterChange(filters: Record<string, string[]>) {
		activeFilters = filters;
		if (hasSearched) {
			search();
		}
	}

	async function handleFieldValueSearch(field: string, searchTerm: string): Promise<string[]> {
		if (!selectedSourceId) return [];
		const result = await searchFieldValues({
			sourceId: selectedSourceId,
			field,
			searchTerm,
			query: queryText || '*',
			timeRange: (timeRange.type === 'relative' ? timeRange.preset : '15m') as '15m',
			startTimestamp: searchStartTimestamp,
			endTimestamp: searchEndTimestamp
		});
		return result.values;
	}

	function handleScroll() {
		if (!scrollElement) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollElement;
		if (scrollHeight - scrollTop - clientHeight < 300 && !loading && logs.length < numHits) {
			search(true);
		}
	}
</script>

<div class="flex h-full w-full">
	<div class="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-base-300 bg-base-100">
		<QuickFilterPanel
			fields={quickFilterFields}
			{aggregations}
			bind:activeFilters
			onfilter={handleFilterChange}
			availableFields={quickFilterAvailableFields}
			onconfigchange={handleQuickFilterFieldsChange}
			onsearch={handleFieldValueSearch}
		/>
		<FieldPanel
			availableFields={panelAvailableFields}
			bind:activeFields
			onchange={handleFieldsChange}
			loading={fieldsLoading}
		/>
	</div>

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
					class="input-bordered input input-sm min-w-0 flex-1"
					placeholder="Lucene query (e.g. level:error AND service:api)"
					bind:value={baseQuery}
					onkeydown={handleKeydown}
				/>

				<TimeRangePicker
					value={timeRange}
					{timezoneMode}
					onchange={handleTimeRangeChange}
					ontimezonechange={(mode) => (timezoneMode = mode)}
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
				<div class="join">
					{#each [['none', 'No wrap'], ['wrap', 'Wrap'], ['pretty', 'Pretty']] as [mode, label] (mode)}
						<button
							class="btn btn-xs join-item w-18 {wrapMode === mode ? 'btn-primary' : ''}"
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
					<span class="loading loading-sm loading-spinner"></span>
				</div>
			{:else if logs.length === 0}
				<div class="flex h-full items-center justify-center">
					<p class="text-sm text-base-content/40">No logs found</p>
				</div>
			{:else}
				<div class="w-fit min-w-full">
					{#each logs as hit, i (i)}
						<LogRow
							{hit}
							{wrapMode}
							{timezoneMode}
							levelField={selectedSource?.levelField ?? 'level'}
							timestampField={selectedSource?.timestampField ?? 'timestamp'}
							messageField={selectedSource?.messageField ?? 'message'}
							extraFields={extraFieldNames}
							{columnWidths}
						/>
					{/each}
					{#if loading}
						<div class="flex justify-center py-4">
							<span class="loading loading-sm loading-spinner"></span>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
