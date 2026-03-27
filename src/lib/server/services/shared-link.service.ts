import { db } from '$lib/server/db';
import { sharedLink } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fingerprint, extractTimestampSeconds } from '$lib/server/utils/fingerprint';
import { getQuickwitClient } from '$lib/server/quickwit';

function generateCode(length: number = 8): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export async function createSharedLink(
	userId: string,
	indexName: string,
	query: string,
	startTime: number,
	endTime: number,
	hit: Record<string, unknown>,
	timestampField: string
): Promise<string> {
	const logFingerprint = fingerprint(hit, timestampField);
	const logTimestamp = extractTimestampSeconds(hit, timestampField);
	const code = generateCode();

	await db.insert(sharedLink).values({
		code,
		userId,
		indexName,
		query,
		startTime,
		endTime,
		logTimestamp,
		logFingerprint
	});

	return code;
}

export async function resolveSharedLink(code: string) {
	const [link] = await db.select().from(sharedLink).where(eq(sharedLink.code, code));
	if (!link) return null;
	return link;
}

export async function findMatchingHit(
	indexName: string,
	logTimestamp: number,
	logFingerprint: string,
	timestampField: string
): Promise<Record<string, unknown> | null> {
	const client = getQuickwitClient();
	const idx = client.index(indexName);
	const PAGE_SIZE = 200;
	const MAX_PAGES = 5;
	let offset = 0;

	for (let page = 0; page < MAX_PAGES; page++) {
		const q = idx
			.query('*')
			.limit(PAGE_SIZE)
			.offset(offset)
			.sortBy(timestampField, 'asc');
		q.timeRange(logTimestamp, logTimestamp + 1);

		const result = await idx.search(q);

		for (const hit of result.hits) {
			if (fingerprint(hit, timestampField) === logFingerprint) {
				return hit;
			}
		}

		if (result.hits.length < PAGE_SIZE) break;
		offset += result.hits.length;
	}

	return null;
}
