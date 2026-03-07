<script lang="ts">
	import Icon from '@iconify/svelte';
	import { page } from '$app/state';
	import { signOut } from '$lib/api/auth.remote';

	let { children } = $props();

	const titles: Record<string, string> = {
		'/': 'Home',
		'/logs': 'Logs',
		'/settings': 'Settings'
	};

	let pageTitle = $derived(titles[page.url.pathname] ?? 'Logwit');
</script>

<div class="flex h-screen w-screen">
	<aside class="flex h-screen w-64 flex-col border-r border-base-300 bg-base-200">
		<div class="flex h-16 items-center justify-center border-b border-base-300">
			<p class="text-xl font-semibold">Logwit</p>
		</div>
		<ul class="menu w-64 flex-1 p-2">
			<li>
				<a href="/" class:menu-active={page.url.pathname === '/'}>
					<Icon icon="lucide:house" width="20" height="20" />
					Home
				</a>
			</li>
			<li>
				<a href="/logs" class:menu-active={page.url.pathname.startsWith('/logs')}>
					<Icon icon="lucide:file-text" width="20" height="20" />
					Logs
				</a>
			</li>
			<li>
				<a href="/settings" class:menu-active={page.url.pathname.startsWith('/settings')}>
					<Icon icon="lucide:settings" width="20" height="20" />
					Settings
				</a>
			</li>
		</ul>
		<div class="border-t border-base-300 p-2">
			<button class="btn btn-ghost btn-sm w-full" onclick={() => signOut()}>
				<Icon icon="lucide:log-out" width="16" height="16" />
				Sign Out
			</button>
		</div>
	</aside>

	<div class="flex flex-1 flex-col overflow-hidden">
		<div class="flex h-16 items-center border-b border-base-300 bg-white px-4">
			<div class="mx-auto w-full max-w-6xl">
				<h1 class="text-sm font-medium">{pageTitle}</h1>
			</div>
		</div>
		<div class="min-h-0 flex-1">
			{@render children()}
		</div>
	</div>
</div>
