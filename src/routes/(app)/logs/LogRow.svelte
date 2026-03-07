<script lang="ts">
	let {
		hit,
		wrapMode,
		levelField = 'level',
		timestampField = 'timestamp',
		messageField = 'message',
		extraFields = []
	}: {
		hit: Record<string, unknown>;
		wrapMode: 'none' | 'wrap' | 'pretty';
		levelField?: string;
		timestampField?: string;
		messageField?: string;
		extraFields?: string[];
	} = $props();

	function extractSeverity(doc: Record<string, unknown>): string {
		const raw = (doc[levelField] ?? 'unknown') as string;
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
		const raw = doc[timestampField];
		if (!raw) return '';
		const date = new Date(raw as string | number);
		if (isNaN(date.getTime())) return String(raw);
		const y = date.getFullYear();
		const mo = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		const h = String(date.getHours()).padStart(2, '0');
		const mi = String(date.getMinutes()).padStart(2, '0');
		const s = String(date.getSeconds()).padStart(2, '0');
		const ms = String(date.getMilliseconds()).padStart(3, '0');
		return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
	}

	function extractMessage(doc: Record<string, unknown>): string {
		const raw = doc[messageField];
		if (raw !== undefined && raw !== null) return String(raw);
		return JSON.stringify(doc);
	}

	function formatContent(doc: Record<string, unknown>, mode: 'none' | 'wrap' | 'pretty'): string {
		const message = extractMessage(doc);
		if (mode === 'pretty') {
			try {
				return JSON.stringify(JSON.parse(message), null, 2);
			} catch {
				return message;
			}
		}
		return message;
	}

	function isError(sev: string): boolean {
		return sev === 'error' || sev === 'fatal' || sev === 'critical';
	}

	const severity = $derived(extractSeverity(hit));
</script>

<div
	class="flex items-stretch border-b border-base-content/5 font-mono text-[13px] leading-[22px] hover:bg-white/[0.03]"
>
	<div class="w-1 shrink-0 rounded-full {severityColor(severity)}"></div>
	<span class="shrink-0 py-px pl-3 text-base-content/40">{extractTimestamp(hit)}</span>
	{#each extraFields as field (field)}
		<span class="shrink-0 truncate py-px pl-2">{hit[field] ?? ''}</span>
	{/each}
	<span
		class="py-px pl-2 text-base-content/80 {wrapMode !== 'none'
			? 'min-w-0 break-all whitespace-pre-wrap'
			: 'whitespace-nowrap'}">{formatContent(hit, wrapMode)}</span
	>
</div>
