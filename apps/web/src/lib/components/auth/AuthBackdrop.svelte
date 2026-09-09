<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="auth-grid pointer-events-none fixed inset-0 z-0" aria-hidden="true"></div>

<div class="relative z-10 m-auto flex w-full max-w-[480px] shrink-0 flex-col gap-4">
	<a href="/" class="flex w-fit items-center gap-2" aria-label="Rootprint home">
		<img src="/logo.png" alt="" class="h-7 w-7 object-contain" />
		<span class="text-lg font-semibold tracking-tight">Rootprint</span>
	</a>
	<div
		class="border-base-300 bg-auth-card flex min-h-[480px] min-w-0 flex-col justify-center border p-7 [&_.alert]:rounded-none [&_.btn]:rounded-none [&_.input]:rounded-none [&_.select]:rounded-none"
	>
		{@render children()}
	</div>
</div>
