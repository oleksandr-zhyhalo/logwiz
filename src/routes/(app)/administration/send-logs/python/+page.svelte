<script lang="ts">
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';

	let { data } = $props();

	const installCommand = 'pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http';

	const exampleCode = `import logging
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter

logger_provider = LoggerProvider()
set_logger_provider(logger_provider)
logger_provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter()))

logging.getLogger().addHandler(LoggingHandler(logger_provider=logger_provider))
logging.getLogger().setLevel(logging.INFO)

logging.info("Hello from Python to Logwiz")`;

	let envVars = $derived(
		`OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${data.origin}/api/otlp/v1/logs
OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20<your-ingest-token>`
	);
</script>

<SendLogsSourceShell title="Python" hasToken={data.hasToken}>
	<section class="flex flex-col gap-2">
		<h3 class="text-sm font-semibold">1. Install</h3>
		<div class="relative">
			<pre class="overflow-x-auto rounded-lg bg-neutral p-4 font-mono text-sm text-neutral-content">{installCommand}</pre>
			<div class="absolute top-2 right-2">
				<CopyButton
					text={installCommand}
					class="btn text-neutral-content/70 btn-ghost btn-xs hover:text-neutral-content"
					title="Copy install command"
				/>
			</div>
		</div>
		<p class="text-xs text-base-content/60">
			The proto-HTTP exporter is what Logwiz's OTLP endpoint accepts.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h3 class="text-sm font-semibold">2. Minimal example</h3>
		<div class="relative">
			<pre class="overflow-x-auto rounded-lg bg-neutral p-4 font-mono text-sm leading-relaxed text-neutral-content">{exampleCode}</pre>
			<div class="absolute top-2 right-2">
				<CopyButton
					text={exampleCode}
					class="btn text-neutral-content/70 btn-ghost btn-xs hover:text-neutral-content"
					title="Copy example"
				/>
			</div>
		</div>
		<p class="text-xs text-base-content/60">
			The exporter reads the endpoint and auth header from the environment variables below, so this
			snippet is identical for every deployment.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h3 class="text-sm font-semibold">3. Environment variables</h3>
		<div class="relative">
			<pre class="overflow-x-auto rounded-lg bg-neutral p-4 font-mono text-sm text-neutral-content">{envVars}</pre>
			<div class="absolute top-2 right-2">
				<CopyButton
					text={() => envVars}
					class="btn text-neutral-content/70 btn-ghost btn-xs hover:text-neutral-content"
					title="Copy environment variables"
				/>
			</div>
		</div>
		<p class="text-xs text-base-content/60">
			The <code class="font-mono">%20</code> after <code class="font-mono">Bearer</code> is required —
			OTEL expects URL-encoded header values.
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h3 class="text-sm font-semibold">Next steps</h3>
		<p class="text-sm text-base-content/70">
			For attributes, resources, and auto-instrumentation, see the
			<a
				class="link"
				href="https://opentelemetry.io/docs/languages/python/"
				target="_blank"
				rel="noreferrer noopener"
			>
				official OpenTelemetry Python docs
			</a>.
		</p>
	</section>
</SendLogsSourceShell>
