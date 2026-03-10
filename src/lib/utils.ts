import type { TimeRange } from '$lib/types';
import { TIME_PRESETS } from '$lib/types';

export function resolveTimeRange(range: TimeRange): { startTs?: number; endTs?: number } {
	if (range.type === 'absolute') {
		return { startTs: range.start, endTs: range.end };
	}
	const preset = TIME_PRESETS.find((p) => p.code === range.preset);
	if (!preset) return {};
	const endTs = Math.floor(Date.now() / 1000);
	return { startTs: endTs - preset.seconds, endTs };
}

export function formatTimeRangeLabel(range: TimeRange, timezone: 'utc' | 'local'): string {
	if (range.type === 'relative') {
		const preset = TIME_PRESETS.find((p) => p.code === range.preset);
		return preset?.label ?? range.preset;
	}
	const opts: Intl.DateTimeFormatOptions = {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		...(timezone === 'utc' ? { timeZone: 'UTC' } : {})
	};
	const fmt = new Intl.DateTimeFormat(undefined, opts);
	const start = fmt.format(new Date(range.start * 1000));
	const end = fmt.format(new Date(range.end * 1000));
	return `${start} → ${end}`;
}

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	let current: unknown = obj;
	for (const key of path.split('.')) {
		if (current === null || current === undefined || typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

export function formatFieldValue(val: unknown): string {
	if (val === undefined || val === null) return '';
	if (typeof val === 'object') return JSON.stringify(val);
	return String(val);
}

/**
 * QuickwitClient adds /api/v1 internally, so strip it if present in user-provided URLs.
 */
export function normalizeQuickwitUrl(url: string): string {
	return url.replace(/\/api\/v1\/?$/, '');
}

export function escapeFilterValue(value: string): string {
	if (/[\s:()[\]{}!+\-~^"\\*?/&|]/.test(value)) {
		return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
	}
	return value;
}

/**
 * Build a Lucene filter clause from active quick filters.
 * E.g. { level: ["error", "warn"], service: ["api"] }
 * → '(level:error OR level:warn) AND service:api'
 */
export function buildFilterClause(filters: Record<string, string[]>): string {
	const clauses: string[] = [];
	for (const [field, values] of Object.entries(filters)) {
		if (!values.length) continue;
		if (values.length === 1) {
			clauses.push(`${field}:${escapeFilterValue(values[0])}`);
		} else {
			clauses.push(`(${values.map((v) => `${field}:${escapeFilterValue(v)}`).join(' OR ')})`);
		}
	}
	return clauses.join(' AND ');
}

/**
 * Combine a base query with filter clauses.
 * If base is empty or '*', just returns the filter clause (or '*' if no filters).
 */
export function combineQueryWithFilters(
	baseQuery: string,
	filters: Record<string, string[]>
): string {
	const filterClause = buildFilterClause(filters);
	const base = baseQuery.trim();

	if (!filterClause) return base || '*';
	if (!base || base === '*') return filterClause;
	return `${base} AND ${filterClause}`;
}
