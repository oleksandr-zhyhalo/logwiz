<script lang="ts" module>
	export type IndexDetailTab = 'overview' | 'fields' | 'sources' | 'configuration';
</script>

<script lang="ts">
	let {
		activeTab,
		fieldCount,
		sourceCount
	}: {
		activeTab: IndexDetailTab;
		fieldCount: number;
		sourceCount: number;
	} = $props();

	type TabDef = { id: IndexDetailTab; label: string; count: number | null };

	const tabs: TabDef[] = $derived([
		{ id: 'overview', label: 'Overview', count: null },
		{ id: 'fields', label: 'Fields', count: fieldCount },
		{ id: 'sources', label: 'Sources', count: sourceCount },
		{ id: 'configuration', label: 'Configuration', count: null }
	]);
</script>

<div
	role="tablist"
	aria-label="Index sections"
	class="flex items-center gap-1 border-b border-base-300"
>
	{#each tabs as tab (tab.id)}
		{@const isActive = tab.id === activeTab}
		<a
			href="?tab={tab.id}"
			role="tab"
			aria-current={isActive ? 'page' : undefined}
			aria-selected={isActive}
			class="flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors"
			class:border-base-content={isActive}
			class:font-medium={isActive}
			class:border-transparent={!isActive}
			class:text-base-content={isActive}
			class:text-base-content_60={!isActive}
		>
			<span>{tab.label}</span>
			{#if tab.count !== null}
				<span class="badge badge-ghost badge-sm">{tab.count}</span>
			{/if}
		</a>
	{/each}
</div>

<style>
	.text-base-content_60 {
		color: color-mix(in srgb, var(--color-base-content) 60%, transparent);
	}
	.text-base-content_60:hover {
		color: var(--color-base-content);
	}
</style>
