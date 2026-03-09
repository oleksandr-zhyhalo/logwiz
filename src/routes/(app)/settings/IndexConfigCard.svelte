<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getIndexConfig, saveIndexConfig } from '$lib/api/indexes.remote';

	let { indexId }: { indexId: string } = $props();

	let expanded = $state(false);
	let loading = $state(false);
	let saving = $state(false);
	let loaded = $state(false);
	let levelField = $state('level');
	let timestampField = $state('timestamp');
	let messageField = $state('message');

	async function toggle() {
		expanded = !expanded;
		if (expanded && !loaded) {
			loading = true;
			try {
				const config = await getIndexConfig(indexId);
				levelField = config.levelField;
				timestampField = config.timestampField;
				messageField = config.messageField;
				loaded = true;
			} finally {
				loading = false;
			}
		}
	}

	async function save() {
		saving = true;
		try {
			await saveIndexConfig({
				indexName: indexId,
				levelField,
				timestampField,
				messageField
			});
		} finally {
			saving = false;
		}
	}
</script>

<div class="rounded-lg border border-base-300 bg-base-100">
	<button
		class="flex w-full items-center gap-2 px-3 py-2 text-left"
		onclick={toggle}
	>
		<Icon
			icon={expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'}
			width="14"
			height="14"
			class="text-base-content/40"
		/>
		<span class="text-sm font-medium">{indexId}</span>
	</button>

	{#if expanded}
		<div class="border-t border-base-300 px-3 py-3">
			{#if loading}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				<div class="grid grid-cols-3 gap-2">
					<label class="floating-label">
						<span>Level Field</span>
						<input
							type="text"
							class="input-bordered input w-full input-sm"
							bind:value={levelField}
						/>
					</label>
					<label class="floating-label">
						<span>Timestamp Field</span>
						<input
							type="text"
							class="input-bordered input w-full input-sm"
							bind:value={timestampField}
						/>
					</label>
					<label class="floating-label">
						<span>Message Field</span>
						<input
							type="text"
							class="input-bordered input w-full input-sm"
							bind:value={messageField}
						/>
					</label>
				</div>
				<div class="mt-2 flex justify-end">
					<button
						class="btn btn-sm btn-primary"
						onclick={save}
						disabled={saving}
					>
						{saving ? 'Saving...' : 'Save'}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
