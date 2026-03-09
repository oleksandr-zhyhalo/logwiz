<script lang="ts">
	import { createHighlighterCore } from 'shiki/core';
	import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
	import type { HighlighterCore } from 'shiki/core';

	let { code }: { code: string } = $props();

	let highlightedHtml = $state('');

	let highlighterPromise: Promise<HighlighterCore> | null = null;

	function getHighlighter(): Promise<HighlighterCore> {
		if (!highlighterPromise) {
			highlighterPromise = createHighlighterCore({
				themes: [import('@shikijs/themes/github-light')],
				langs: [import('@shikijs/langs/json')],
				engine: createJavaScriptRegexEngine()
			});
		}
		return highlighterPromise;
	}

	async function highlight(source: string) {
		try {
			const highlighter = await getHighlighter();
			highlightedHtml = highlighter.codeToHtml(source, {
				lang: 'json',
				theme: 'github-light'
			});
		} catch {
			highlightedHtml = '';
		}
	}

	$effect(() => {
		highlight(code);
	});
</script>

{#if highlightedHtml}
	<div class="shiki-wrapper">
		{@html highlightedHtml}
	</div>
{:else}
	<pre class="break-all whitespace-pre-wrap">{code}</pre>
{/if}

<style>
	.shiki-wrapper :global(pre) {
		background: transparent !important;
		margin: 0;
		padding: 0;
	}
	.shiki-wrapper :global(code) {
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
	}
</style>
