import { json, type RequestHandler } from '@sveltejs/kit';

import { config } from '$lib/server/config';
import { logger } from '$lib/server/logger';
import { verifyIngestToken } from '$lib/server/services/ingest-token.service';

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

type VerifyResult = { id: number; name: string } | null;

type IngestDependencies = {
	verifyToken: (token: string, indexId: string) => VerifyResult;
	forwardIngest: (
		indexId: string,
		search: string,
		body: ArrayBuffer,
		contentType: string | null
	) => Promise<Response>;
};

function extractBearerToken(authorizationHeader: string | null): string | null {
	if (!authorizationHeader) return null;
	const [scheme, ...tokenParts] = authorizationHeader.trim().split(/\s+/);
	if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
	const token = tokenParts.join(' ').trim();
	return token.length > 0 ? token : null;
}

function buildUpstreamEndpoint(indexId: string, search: string): string {
	const quickwitBase = config.quickwitUrl.replace(/\/+$/, '');
	return `${quickwitBase}/${encodeURIComponent(indexId)}/ingest${search}`;
}

const defaultDependencies: IngestDependencies = {
	verifyToken: verifyIngestToken,
	forwardIngest: async (indexId, search, body, contentType) => {
		const endpoint = buildUpstreamEndpoint(indexId, search);
		return fetch(endpoint, {
			method: 'POST',
			headers: {
				'content-type': contentType ?? 'application/json'
			},
			body
		});
	}
};

export function _createIngestHandler(
	dependencies: IngestDependencies = defaultDependencies
): RequestHandler {
	return async ({ params, request }) => {
		const indexId = (params as { indexId: string }).indexId;
		const search = new URL(request.url).search;
		const token = extractBearerToken(request.headers.get('authorization'));
		if (!token) {
			logger.warn({ indexId }, 'ingest rejected: missing bearer token');
			return json({ message: 'Missing bearer token' }, { status: 401 });
		}

		const verifiedToken = dependencies.verifyToken(token, indexId);
		if (!verifiedToken) {
			logger.warn({ indexId }, 'ingest rejected: invalid token');
			return json({ message: 'Invalid ingest token' }, { status: 403 });
		}

		const contentLength = request.headers.get('content-length');
		if (contentLength) {
			const parsedLength = Number.parseInt(contentLength, 10);
			if (Number.isFinite(parsedLength) && parsedLength > MAX_BODY_BYTES) {
				logger.warn({ indexId, contentLength: parsedLength }, 'ingest rejected: body too large');
				return json({ message: 'Request body too large' }, { status: 413 });
			}
		}

		const body = await request.arrayBuffer();
		if (body.byteLength > MAX_BODY_BYTES) {
			logger.warn({ indexId, bodySize: body.byteLength }, 'ingest rejected: body too large');
			return json({ message: 'Request body too large' }, { status: 413 });
		}

		if (body.byteLength === 0) {
			logger.warn({ indexId }, 'ingest rejected: empty body');
			return json({ message: 'Request body is required' }, { status: 400 });
		}

		try {
			const upstream = await dependencies.forwardIngest(
				indexId,
				search,
				body,
				request.headers.get('content-type')
			);
			logger.debug({ indexId, upstreamStatus: upstream.status }, 'ingest forwarded');
			const responseBody = await upstream.text();
			const headers = new Headers();
			const contentType = upstream.headers.get('content-type');
			if (contentType) {
				headers.set('content-type', contentType);
			}

			return new Response(responseBody, {
				status: upstream.status,
				headers
			});
		} catch (err) {
			logger.error({ indexId, err }, 'ingest upstream forwarding failed');
			return json({ message: 'Failed to forward ingest request' }, { status: 502 });
		}
	};
}

export const POST: RequestHandler = _createIngestHandler();
