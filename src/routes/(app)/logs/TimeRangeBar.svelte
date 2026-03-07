<script lang="ts">
	let {
		value = '15m',
		onchange
	}: {
		value: string;
		onchange: (range: string) => void;
	} = $props();

	const presets = ['15m', '1h', '6h', '24h', '7d'];
</script>

<div class="flex gap-1">
	{#each presets as preset (preset)}
		<button
			class="btn btn-xs {value === preset ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => onchange(preset)}
		>
			{preset}
		</button>
	{/each}
</div>
