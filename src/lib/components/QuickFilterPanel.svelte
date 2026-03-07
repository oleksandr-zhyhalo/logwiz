<script lang="ts">
	import Icon from '@iconify/svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let {
		fields,
		aggregations,
		activeFilters = $bindable(),
		onfilter
	}: {
		fields: string[];
		aggregations: Record<string, string[]>;
		activeFilters: Record<string, string[]>;
		onfilter?: (filters: Record<string, string[]>) => void;
	} = $props();

	let collapsed = $state(false);
	let openSections = new SvelteSet<string>();

	// Open first section by default, reset on fields change
	$effect(() => {
		if (fields.length > 0) {
			openSections.clear();
			openSections.add(fields[0]);
		}
	});

	function toggleSection(field: string) {
		if (openSections.has(field)) {
			openSections.delete(field);
		} else {
			openSections.add(field);
		}
	}

	function toggleValue(field: string, value: string) {
		const current = activeFilters[field] ?? [];
		const next = current.includes(value)
			? current.filter((v) => v !== value)
			: [...current, value];

		const updated = { ...activeFilters };
		if (next.length === 0) {
			delete updated[field];
		} else {
			updated[field] = next;
		}
		activeFilters = updated;
		onfilter?.(updated);
	}

	let hasAnyFilters = $derived(Object.keys(activeFilters).length > 0);

	function clearAllFilters() {
		activeFilters = {};
		onfilter?.({});
	}

	function isChecked(field: string, value: string): boolean {
		return activeFilters[field]?.includes(value) ?? false;
	}
</script>

{#if fields.length > 0}
	<div class="border-b border-base-300">
		<div class="flex items-center px-3 py-2">
			<button class="flex flex-1 items-center" onclick={() => (collapsed = !collapsed)}>
				<Icon
					icon={collapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'}
					width="14"
					height="14"
					class="mr-1 text-base-content/40"
				/>
				<h3 class="flex-1 text-left text-xs font-semibold uppercase tracking-wider text-base-content/60">
					Filters
				</h3>
			</button>
			{#if hasAnyFilters}
				<button class="btn btn-ghost btn-xs p-0" onclick={clearAllFilters} title="Clear all filters">
					<Icon icon="lucide:x" width="14" height="14" class="text-base-content/40" />
				</button>
			{/if}
		</div>

		{#if !collapsed}
			<div class="flex flex-col">
				{#each fields as field (field)}
					{@const values = aggregations[field] ?? []}
					<div class="border-t border-base-300/50">
						<button
							class="flex w-full items-center px-3 py-1.5"
							onclick={() => toggleSection(field)}
						>
							<Icon
								icon={openSections.has(field) ? 'lucide:chevron-down' : 'lucide:chevron-right'}
								width="12"
								height="12"
								class="mr-1 text-base-content/40"
							/>
							<span class="flex-1 text-left text-xs font-medium text-base-content/70">{field}</span>
							{#if activeFilters[field]?.length}
								<span class="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">
									{activeFilters[field].length}
								</span>
							{/if}
						</button>

						{#if openSections.has(field)}
							<div class="px-3 pb-2">
								{#if values.length === 0}
									<p class="py-1 text-[11px] text-base-content/30">
										Run a search to see values
									</p>
								{:else}
									<div class="flex flex-col gap-0.5">
										{#each values as value (value)}
											<label class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-base-200">
												<input
													type="checkbox"
													class="checkbox checkbox-xs"
													checked={isChecked(field, value)}
													onchange={() => toggleValue(field, value)}
												/>
												<span class="truncate">{value}</span>
											</label>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
