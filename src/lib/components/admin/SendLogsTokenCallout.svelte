<script lang="ts">
	import { AlertTriangle, Info } from 'lucide-svelte';

	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';

	let {
		hasToken
	}: {
		hasToken: boolean;
	} = $props();
</script>

{#if hasToken}
	<div class="flex items-start gap-2 rounded-lg border border-base-300 bg-base-200/40 px-4 py-3 text-sm">
		<Info size={16} class="mt-0.5 shrink-0 opacity-70" />
		<span>
			Using your ingest token for <code class="font-mono">{DEFAULT_OTEL_LOGS_INDEX_ID}</code>.
			Replace <code class="font-mono">&lt;your-ingest-token&gt;</code> in the snippets below with its value.
		</span>
	</div>
{:else}
	<div class="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
		<AlertTriangle size={18} class="mt-0.5 shrink-0 text-warning" />
		<div class="flex-1">
			<p>
				You need an ingest token for <code class="font-mono">{DEFAULT_OTEL_LOGS_INDEX_ID}</code>
				before you can send logs.
			</p>
			<a href="/administration/tokens" class="mt-2 inline-block btn btn-sm btn-warning">
				Create a token →
			</a>
		</div>
	</div>
{/if}
