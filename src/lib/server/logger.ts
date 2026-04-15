import pino from 'pino';

import { env } from '$env/dynamic/private';

const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
const configuredLevel = env.LOGWIZ_LOG_LEVEL?.toLowerCase() ?? 'info';

export const logger = pino({
	name: 'logwiz',
	level: validLevels.includes(configuredLevel) ? configuredLevel : 'info',
	transport: {
		target: 'pino-pretty',
		options: {
			colorize: true,
			singleLine: true,
			messageFormat: '{if userEmail}{userEmail} {end}{msg}',
			ignore: 'pid,hostname,name,userEmail'
		}
	}
});

export type Logger = pino.Logger;

export function resolveRequestId(headers: Headers): string {
	const inbound = headers.get('x-request-id')?.trim();
	return inbound || crypto.randomUUID();
}

export function createRequestLogger(ctx: {
	requestId: string;
	method: string;
	path: string;
	userId?: string;
}): pino.Logger {
	return logger.child(ctx);
}

export function createOperationLogger(
	parent: pino.Logger,
	ctx: Record<string, unknown>
): pino.Logger {
	return parent.child(ctx);
}
