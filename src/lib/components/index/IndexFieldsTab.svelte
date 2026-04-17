<script lang="ts">
	import type { AdminIndexField } from '$lib/types';

	let { fields }: { fields: AdminIndexField[] } = $props();

	let filter = $state('');

	const filtered = $derived.by(() => {
		const query = filter.trim().toLowerCase();
		if (!query) return fields;
		return fields.filter((field) => field.name.toLowerCase().includes(query));
	});

	const countLabel = $derived.by(() => {
		if (filter.trim().length > 0) {
			return `${filtered.length} of ${fields.length}`;
		}
		return `${fields.length} field${fields.length === 1 ? '' : 's'}`;
	});
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
		<div>
			<h3 class="text-base font-semibold">Fields</h3>
			<p class="text-xs text-base-content/50">{countLabel}</p>
		</div>
		<input
			class="input-bordered input input-sm w-full md:max-w-xs"
			placeholder="Filter fields..."
			aria-label="Filter fields"
			bind:value={filter}
		/>
	</div>

	<div class="overflow-x-auto rounded-box border border-base-300">
		<table class="table table-sm">
			<thead class="sticky top-0 bg-base-100">
				<tr>
					<th>Name</th>
					<th>Type</th>
					<th>Fast</th>
					<th>Indexed</th>
					<th>Stored</th>
					<th>Record</th>
					<th>Tokenizer</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as field (field.name)}
					<tr class="group hover:bg-base-200">
						<td>
							<div class="font-medium">{field.name}</div>
							{#if field.description}
								<div class="text-[10px] text-base-content/60">
									{field.description}
								</div>
							{/if}
						</td>
						<td>
							<span class="badge badge-sm">{field.type}</span>
						</td>
						<td>
							{#if field.fast}
								<span class="text-success">✓</span>
							{:else}
								<span class="text-base-content/50">—</span>
							{/if}
						</td>
						<td>
							{#if field.indexed}
								<span class="text-success">✓</span>
							{:else}
								<span class="text-base-content/50">—</span>
							{/if}
						</td>
						<td>
							{#if field.stored}
								<span class="text-success">✓</span>
							{:else}
								<span class="text-base-content/50">—</span>
							{/if}
						</td>
						<td class="text-base-content/60">{field.record ?? '—'}</td>
						<td class="text-base-content/60">{field.tokenizer ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
