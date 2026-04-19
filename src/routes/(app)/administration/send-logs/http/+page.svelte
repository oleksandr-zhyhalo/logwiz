<script lang="ts">
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';

	let { data } = $props();

	let endpointUrl = $derived(`${data.origin}/api/ingest/{indexId}`);

	let curlExample = $derived(
		`curl -X POST ${data.origin}/api/ingest/my-index \\
  -H "Authorization: Bearer <your-ingest-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello from my app", "level": "info"}'`
	);
</script>

<SendLogsSourceShell title="HTTP" hasToken={data.hasToken}>
	<section class="flex flex-col gap-2">
		<h3 class="text-sm font-semibold">Endpoint</h3>
		<div class="flex items-center gap-2">
			<code
				class="flex-1 rounded border border-base-300 bg-base-200/50 px-3 py-2 font-mono text-sm"
			>
				{endpointUrl}
			</code>
			<CopyButton
				text={() => endpointUrl}
				class="btn btn-ghost btn-sm"
				title="Copy endpoint URL"
			/>
		</div>
		<p class="text-xs text-base-content/60">
			Send NDJSON or JSON to this path. The <code class="font-mono">{'{indexId}'}</code> segment must
			match the index bound to your ingest token.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h3 class="text-sm font-semibold">Example request</h3>
		<div class="relative">
			<pre class="overflow-x-auto rounded-lg bg-neutral p-4 font-mono text-sm leading-relaxed text-neutral-content">{curlExample}</pre>
			<div class="absolute top-2 right-2">
				<CopyButton
					text={() => curlExample}
					class="btn text-neutral-content/70 btn-ghost btn-xs hover:text-neutral-content"
					title="Copy example"
				/>
			</div>
		</div>
	</section>
</SendLogsSourceShell>
