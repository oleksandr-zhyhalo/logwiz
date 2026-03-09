<script lang="ts">
	import Icon from '@iconify/svelte';
	import { page } from '$app/state';
	import { signOut } from '$lib/api/auth.remote';
	import { browser } from '$app/environment';

	let { children } = $props();

	const titles: Record<string, string> = {
		'/': 'Home',
		'/logs': 'Logs',
		'/settings': 'Settings'
	};

	let pageTitle = $derived(titles[page.url.pathname] ?? 'Logwit');

	let collapsed = $state(browser ? localStorage.getItem('sidebar-collapsed') === 'true' : false);

	function toggleSidebar() {
		collapsed = !collapsed;
		localStorage.setItem('sidebar-collapsed', String(collapsed));
	}

	const menuItems = [
		{ href: '/', icon: 'lucide:house', label: 'Home', active: () => page.url.pathname === '/' },
		{
			href: '/logs',
			icon: 'lucide:file-text',
			label: 'Logs',
			active: () => page.url.pathname.startsWith('/logs')
		},
		{
			href: '/settings',
			icon: 'lucide:settings',
			label: 'Settings',
			active: () => page.url.pathname.startsWith('/settings')
		}
	];
</script>

<div class="flex h-screen w-screen">
	<aside
		class="flex h-screen flex-col border-r border-base-300 bg-base-200 transition-all duration-200"
		class:w-64={!collapsed}
		class:w-16={collapsed}
	>
		<div
			class="flex h-16 items-center border-b border-base-300 px-2"
			class:justify-between={!collapsed}
			class:justify-center={collapsed}
		>
			{#if !collapsed}
				<p class="pl-2 text-xl font-semibold">Logwit</p>
			{/if}
			<button
				class="btn btn-square btn-ghost btn-sm"
				onclick={toggleSidebar}
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				<Icon
					icon={collapsed ? 'lucide:panel-left-open' : 'lucide:panel-left-close'}
					width="16"
					height="16"
					class="opacity-70"
				/>
			</button>
		</div>
		<ul class="menu w-full flex-1 p-2" class:items-center={collapsed}>
			{#each menuItems as item (item.href)}
				<li class="w-full">
					{#if collapsed}
						<a
							href={item.href}
							class="tooltip tooltip-right flex justify-center"
							class:menu-active={item.active()}
							data-tip={item.label}
						>
							<Icon icon={item.icon} width="16" height="16" class="opacity-70" />
						</a>
					{:else}
						<a href={item.href} class:menu-active={item.active()}>
							<Icon icon={item.icon} width="16" height="16" class="opacity-70" />
							{item.label}
						</a>
					{/if}
				</li>
			{/each}
		</ul>
		<div
			class="border-t border-base-300 p-2"
			class:flex={collapsed}
			class:justify-center={collapsed}
		>
			{#if collapsed}
				<button
					class="tooltip btn tooltip-right btn-square btn-ghost btn-sm"
					onclick={() => signOut()}
					data-tip="Sign Out"
				>
					<Icon icon="lucide:log-out" width="14" height="14" class="opacity-70" />
				</button>
			{:else}
				<button class="btn w-full btn-ghost btn-sm" onclick={() => signOut()}>
					<Icon icon="lucide:log-out" width="14" height="14" class="opacity-70" />
					Sign Out
				</button>
			{/if}
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
