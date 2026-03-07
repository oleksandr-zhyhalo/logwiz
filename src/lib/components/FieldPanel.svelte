<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import Icon from '@iconify/svelte';

	let {
		availableFields,
		activeFields = $bindable(),
		onchange,
		onreset,
		hasOverride = false,
		loading = false
	}: {
		availableFields: { name: string; type: string }[];
		activeFields: { id: string; name: string }[];
		onchange?: (fields: string[]) => void;
		onreset?: () => void;
		hasOverride?: boolean;
		loading?: boolean;
	} = $props();

	// Fields not yet in active list
	let filteredAvailable = $derived(
		availableFields.filter((f) => !activeFields.some((a) => a.name === f.name))
	);

	function handleDndConsider(e: CustomEvent<{ items: typeof activeFields }>) {
		activeFields = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: typeof activeFields }>) {
		activeFields = e.detail.items;
		onchange?.(activeFields.map((f) => f.name));
	}

	function addField(name: string) {
		activeFields = [...activeFields, { id: name, name }];
		onchange?.(activeFields.map((f) => f.name));
	}

	function removeField(name: string) {
		activeFields = activeFields.filter((f) => f.name !== name);
		onchange?.(activeFields.map((f) => f.name));
	}
</script>

<div class="flex h-full w-56 shrink-0 flex-col border-r border-base-300 bg-base-100">
	<div class="flex items-center border-b border-base-300 px-3 py-2">
		<h3 class="flex-1 text-xs font-semibold uppercase tracking-wider text-base-content/60">Fields</h3>
		{#if hasOverride && onreset}
			<button class="btn btn-ghost btn-xs p-0" onclick={onreset} title="Reset to default fields">
				<Icon icon="lucide:x" width="14" height="14" class="text-base-content/40" />
			</button>
		{/if}
	</div>

	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
	{:else}
		<div class="flex flex-1 flex-col overflow-y-auto">
			<!-- Active fields (draggable) -->
			<div class="border-b border-base-300 p-2">
				<p class="mb-1 text-xs font-medium text-base-content/50">Active</p>
				{#if activeFields.length === 0}
					<p class="px-1 py-2 text-xs text-base-content/30">No extra fields</p>
				{:else}
					<div
						use:dndzone={{ items: activeFields, flipDurationMs: 150, type: 'active-fields' }}
						onconsider={handleDndConsider}
						onfinalize={handleDndFinalize}
						class="flex flex-col gap-1"
					>
						{#each activeFields as field (field.id)}
							<div
								class="flex items-center gap-1 rounded bg-base-200 px-2 py-1 text-xs"
							>
								<Icon icon="lucide:grip-vertical" width="12" height="12" class="shrink-0 cursor-grab text-base-content/40" />
								<span class="flex-1 truncate">{field.name}</span>
								<button
									class="btn btn-ghost btn-xs p-0"
									onclick={() => removeField(field.name)}
								>
									<Icon icon="lucide:x" width="12" height="12" />
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Available fields -->
			<div class="flex-1 p-2">
				<p class="mb-1 text-xs font-medium text-base-content/50">Available</p>
				<div class="flex flex-col gap-0.5">
					{#each filteredAvailable as field (field.name)}
						<button
							class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-base-200"
							onclick={() => addField(field.name)}
						>
							<Icon icon="lucide:plus" width="12" height="12" class="shrink-0 text-base-content/40" />
							<span class="truncate">{field.name}</span>
							<span class="ml-auto text-[10px] text-base-content/30">{field.type}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>

	{/if}
</div>
