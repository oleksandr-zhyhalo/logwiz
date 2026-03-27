import { flattenObject } from '$lib/utils/log-helpers';
import { normalizeToMs } from '$lib/utils/time';

export function fingerprint(hit: Record<string, unknown>, timestampField?: string): string {
	const entries = flattenObject(hit);
	if (timestampField) {
		for (let i = 0; i < entries.length; i++) {
			if (entries[i][0] === timestampField) {
				const raw = entries[i][1];
				if (raw !== null && raw !== undefined) {
					const ms = typeof raw === 'number' ? normalizeToMs(raw) : new Date(String(raw)).getTime();
					if (!isNaN(ms)) {
						entries[i] = [entries[i][0], Math.floor(ms)];
					}
				}
				break;
			}
		}
	}
	entries.sort((a, b) => a[0].localeCompare(b[0]));
	return JSON.stringify(entries);
}

export function extractTimestampSeconds(log: Record<string, unknown>, timestampField: string): number {
	const flat = flattenObject(log);
	const entry = flat.find(([key]) => key === timestampField);
	if (!entry) throw new Error(`Timestamp field "${timestampField}" not found in log`);
	const raw = entry[1];
	if (typeof raw === 'number') {
		return Math.floor(normalizeToMs(raw) / 1000);
	}
	const date = new Date(String(raw));
	if (isNaN(date.getTime())) throw new Error(`Invalid timestamp value: ${raw}`);
	return Math.floor(date.getTime() / 1000);
}
