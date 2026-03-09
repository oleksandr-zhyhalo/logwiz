<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import Icon from '@iconify/svelte';

	let {
		availableFields,
		activeFields = $bindable(),
		onchange,
		loading = false
	}: {
		availableFields: { name: string; type: string }[];
		activeFields: { id: string; name: string }[];
		onchange?: (fields: string[]) => void;
		loading?: boolean;
	} = $props();

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

{#if loading}
	<div class="flex items-center gap-2 py-2">
		<span class="loading loading-xs loading-spinner"></span>
		<span class="text-xs text-base-content/50">Loading fields...</span>
	</div>
{:else}
	{#if activeFields.length > 0}
		<div
			use:dndzone={{ items: activeFields, flipDurationMs: 150, type: 'chip-fields' }}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
			class="flex flex-wrap gap-1.5"
		>
			{#each activeFields as field (field.id)}
				<span class="badge gap-1 pr-1 badge-primary">
					<Icon icon="lucide:grip-vertical" width="10" height="10" class="cursor-grab opacity-60" />
					{field.name}
					<button
						class="cursor-pointer opacity-60 hover:opacity-100"
						onclick={() => removeField(field.name)}
					>
						<Icon icon="lucide:x" width="10" height="10" />
					</button>
				</span>
			{/each}
		</div>
	{:else}
		<p class="text-xs text-base-content/40">No fields selected</p>
	{/if}

	{#if filteredAvailable.length > 0}
		<div class="mt-2 flex flex-wrap gap-1.5">
			{#each filteredAvailable as field (field.name)}
				<button
					class="badge cursor-pointer gap-1 badge-ghost badge-outline hover:badge-primary"
					onclick={() => addField(field.name)}
				>
					<Icon icon="lucide:plus" width="10" height="10" />
					{field.name}
					<span class="text-[9px] opacity-40">{field.type}</span>
				</button>
			{/each}
		</div>
	{/if}
{/if}
