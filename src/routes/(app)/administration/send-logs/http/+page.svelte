<script lang="ts">
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';

	let { data } = $props();
</script>

<SendLogsSourceShell title="HTTP">
	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<section class="flex flex-col gap-2">
			<h3 class="text-sm font-semibold">Endpoint</h3>
			<div class="flex items-center gap-2">
				<code
					class="flex-1 rounded border border-base-300 bg-base-200/50 px-3 py-2 font-mono text-sm"
				>
					{data.endpointUrl}
				</code>
				<CopyButton
					text={data.endpointUrl}
					class="btn btn-ghost btn-sm"
					title="Copy endpoint URL"
				/>
			</div>
			<p class="text-xs text-base-content/60">Send NDJSON or JSON to this path.</p>
		</section>

		<section class="flex flex-col gap-2">
			<h3 class="text-sm font-semibold">Example request</h3>
			<CodeBlock {...data.snippets.curl} copyTitle="Copy example" />
		</section>
	{/if}
</SendLogsSourceShell>
