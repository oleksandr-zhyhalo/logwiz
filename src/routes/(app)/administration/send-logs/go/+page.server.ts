import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const INSTALL_COMMAND = `go mod init example.com/logwiz-demo
go get go.opentelemetry.io/otel \\
    go.opentelemetry.io/otel/log \\
    go.opentelemetry.io/otel/sdk/log \\
    go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp \\
    go.opentelemetry.io/contrib/bridges/otelslog`;

const EXAMPLE_CODE = `package main

import (
	"context"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/log/global"
	sdklog "go.opentelemetry.io/otel/sdk/log"
)

func main() {
	ctx := context.Background()
	exporter, err := otlploghttp.New(ctx)
	if err != nil {
		panic(err)
	}
	provider := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
	)
	defer provider.Shutdown(ctx)
	global.SetLoggerProvider(provider)

	logger := otelslog.NewLogger("hello")
	logger.Info("Hello from Go to Logwiz")
}`;

const INSTALL_SNIPPET = {
	code: INSTALL_COMMAND,
	html: await highlightCode(INSTALL_COMMAND, 'bash'),
	lang: 'bash'
};

const EXAMPLE_SNIPPET = {
	code: EXAMPLE_CODE,
	html: await highlightCode(EXAMPLE_CODE, 'go'),
	lang: 'go'
};

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	const envVars = `export OTEL_SERVICE_NAME=my-go-service
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${origin}${OTLP_LOGS_INGEST_PATH}
export OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20${token}`;

	return {
		snippets: {
			install: INSTALL_SNIPPET,
			envVars: {
				code: envVars,
				html: await highlightCode(envVars, 'bash'),
				lang: 'bash'
			},
			example: EXAMPLE_SNIPPET
		}
	};
};
