<script lang="ts">
	let { hit, wrapMode }: { hit: Record<string, unknown>; wrapMode: 'none' | 'wrap' | 'pretty' } = $props();

	function extractSeverity(doc: Record<string, unknown>): string {
		const raw = (doc.severity ?? doc.level ?? doc['log.level'] ?? 'unknown') as string;
		return raw.toString().toLowerCase();
	}

	function severityColor(severity: string): string {
		switch (severity) {
			case 'error':
			case 'fatal':
			case 'critical':
				return 'bg-error';
			case 'warn':
			case 'warning':
				return 'bg-warning';
			case 'debug':
			case 'trace':
				return 'bg-accent';
			case 'info':
				return 'bg-info';
			default:
				return 'bg-base-content/30';
		}
	}

	function severityLabel(severity: string): string {
		return severity.toUpperCase();
	}

	function extractTimestamp(doc: Record<string, unknown>): string {
		const raw = doc.timestamp ?? doc['@timestamp'] ?? doc.datetime ?? doc.time;
		if (!raw) return '';
		const date = new Date(raw as string | number);
		if (isNaN(date.getTime())) return String(raw);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3,
			hour12: false
		});
	}

	function formatContent(doc: Record<string, unknown>, mode: 'none' | 'wrap' | 'pretty'): string {
		return mode === 'pretty' ? JSON.stringify(doc, null, 2) : JSON.stringify(doc);
	}

	const severity = $derived(extractSeverity(hit));
</script>

<div
	class="flex items-start gap-2 border-b border-base-300/50 px-3 py-1.5 font-mono text-xs hover:bg-base-200/50"
>
	<span class="w-1 shrink-0 self-stretch rounded-full {severityColor(severity)}"></span>
	<span class="w-14 shrink-0 text-base-content/70">{severityLabel(severity)}</span>
	<span class="w-44 shrink-0 text-base-content/50">{extractTimestamp(hit)}</span>
	<span class="text-base-content/90 {wrapMode !== 'none' ? 'min-w-0 whitespace-pre-wrap break-all' : 'whitespace-nowrap'}"
		>{formatContent(hit, wrapMode)}</span
	>
</div>
