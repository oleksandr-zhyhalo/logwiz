<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	import SendLogsTokenCallout from './SendLogsTokenCallout.svelte';

	let {
		title,
		hasToken,
		children
	}: {
		title: string;
		hasToken: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="flex flex-col gap-5">
	<div>
		<a
			href="/administration/send-logs"
			class="inline-flex items-center gap-1 text-sm text-base-content/60 hover:text-base-content"
		>
			<ArrowLeft size={14} />
			All sources
		</a>
		<h2 class="mt-2 text-xl font-semibold">{title}</h2>
	</div>

	<SendLogsTokenCallout {hasToken} />

	{@render children()}
</div>
