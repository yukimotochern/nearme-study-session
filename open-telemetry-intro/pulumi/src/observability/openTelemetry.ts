import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
export const makeOpenTelemetry = ({ provider }: { provider: k8s.Provider }) => {
  const operator = new k8s.helm.v4.Chart(
    'open-telemetry-operator',
    {
      repositoryOpts: {
        repo: 'https://open-telemetry.github.io/opentelemetry-helm-charts',
      },
      chart: 'opentelemetry-operator',
      values: {
        manager: {
          collectorImage: {
            repository: 'otel/opentelemetry-collector-k8s',
          },
          env: {
            ENABLE_WEBHOOKS: 'false',
          },
        },
        admissionWebhooks: {
          create: false,
        },
      },
    },
    { provider }
  );
  const otlpGrpcPort = 4317;
  const collector = new k8s.apiextensions.CustomResource(
    'open-telemetry-collector',
    {
      apiVersion: 'opentelemetry.io/v1beta1',
      kind: 'OpenTelemetryCollector',
      metadata: {},
      spec: {
        mode: 'daemonset',
        upgradeStrategy: 'none',
        config: {
          receivers: {
            otlp: {
              protocols: {
                grpc: {
                  endpoint: `0.0.0.0:${otlpGrpcPort}`,
                },
              },
            },
          },
          processors: {
            batch: {
              send_batch_size: 10000,
              timeout: '10s',
            },
            'batch/metrics': {
              timeout: '30s',
            },
          },
          exporters: {
            debug: {
              verbosity: 'detailed',
            },
            otlp: {
              endpoint: 'signoz-otel-collector.signoz:4317',
              tls: {
                insecure: true,
              },
            },
          },
          service: {
            pipelines: {
              metrics: {
                receivers: ['otlp'],
                processors: ['batch'],
                exporters: ['debug', 'otlp'],
              },
              traces: {
                receivers: ['otlp'],
                processors: ['batch'],
                exporters: ['debug', 'otlp'],
              },
              logs: {
                receivers: ['otlp'],
                processors: ['batch'],
                exporters: ['debug', 'otlp'],
              },
            },
          },
        },
      },
    },
    { provider, dependsOn: [operator] }
  );
  return {
    otlpGrpcEndpoint: pulumi.interpolate`http://${collector.metadata.name}-collector:${otlpGrpcPort}`,
  };
};
