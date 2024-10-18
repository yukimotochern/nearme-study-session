/*instrumentation.ts*/
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

// Create the SDK instance
const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env['OTEL_SERVICE_NAME'],
    [ATTR_SERVICE_VERSION]: process.env['SERVICE_VERSION'] || '1.0.0',
  }),
  // Add instrumentations
  instrumentations: [
    ...getNodeAutoInstrumentations(),
    new PrismaInstrumentation(),
  ],
  traceExporter: new OTLPTraceExporter({
    url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
    }),
  }),
});

// Start the SDK (and register instrumentations)
sdk.start();
