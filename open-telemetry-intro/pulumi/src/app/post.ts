import * as k8s from '@pulumi/kubernetes';
import * as docker from '@pulumi/docker';
import * as pulumi from '@pulumi/pulumi';
import { randomBytes } from 'node:crypto';

export const makePostService = ({
  provider,
  userService,
  otlpEndpoint,
}: {
  provider: k8s.Provider;
  userService: pulumi.Input<string>;
  otlpEndpoint: pulumi.Input<string>;
}) => {
  const srv = 'post';
  const port = 3000;
  const postgresServiceName = `postgres-${srv}`;
  /* Postgres Statefulset */
  const statefulSet = new k8s.apps.v1.StatefulSet(
    `${srv}-stateful-set`,
    {
      spec: {
        serviceName: postgresServiceName,
        selector: {
          matchLabels: {
            postgres: srv,
          },
        },
        replicas: 1,
        template: {
          metadata: {
            labels: {
              postgres: srv,
            },
          },
          spec: {
            containers: [
              {
                name: srv,
                image: 'postgres:17',
                env: [
                  {
                    name: 'POSTGRES_PASSWORD',
                    value: 'pass',
                  },
                  {
                    name: 'POSTGRES_USER',
                    value: srv,
                  },
                  {
                    name: 'POSTGRES_DB',
                    value: srv,
                  },
                ],
              },
            ],
          },
        },
      },
    },
    { provider }
  );
  /* Postgres Service */
  const postgresService = new k8s.core.v1.Service(
    `${srv}-postgres-service`,
    {
      spec: {
        selector: statefulSet.spec.apply((ob) => ob.selector.matchLabels),
        type: 'NodePort',
        ports: [
          {
            port: 5432,
            targetPort: 5432,
          },
        ],
      },
    },
    { provider }
  );

  /* Docker build */
  const image = new docker.Image(`${srv}-image`, {
    build: {
      context: '.',
      dockerfile: `open-telemetry-intro/${srv}/Dockerfile`,
    },
    registry: {
      server: 'docker.io',
      username: 'cyanchern',
      password: process.env.DOCKER_PASSWORD,
    },
    imageName: `docker.io/cyanchern/${srv}:${randomBytes(10).toString('hex')}`,
  });
  /* Db push */
  const pushJob = new k8s.batch.v1.Job(
    `${srv}-job`,
    {
      spec: {
        completions: 1,
        parallelism: 1,
        backoffLimit: 1,
        template: {
          spec: {
            restartPolicy: 'Never',
            containers: [
              {
                name: srv,
                image: image.imageName,
                command: ['/bin/sh', '-c'],
                args: [
                  `npx prisma db push --accept-data-loss --force-reset --schema=./open-telemetry-intro/${srv}/prisma/schema.prisma`,
                ],
                env: [
                  {
                    name: 'DATABASE_URL',
                    value: pulumi.interpolate`postgresql://${srv}:pass@${postgresService.metadata.name}:5432/${srv}`,
                  },
                ],
              },
            ],
          },
        },
      },
    },
    { provider }
  );
  /* Deploy */
  const deploy = new k8s.apps.v1.Deployment(
    `${srv}-deploy`,
    {
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: srv,
          },
        },
        template: {
          metadata: {
            labels: {
              app: srv,
            },
          },
          spec: {
            containers: [
              {
                name: srv,
                image: image.imageName,
                env: [
                  {
                    name: 'PORT',
                    value: String(port),
                  },
                  {
                    name: 'DATABASE_URL',
                    value: pulumi.interpolate`postgresql://${srv}:pass@${postgresService.metadata.name}:5432/${srv}`,
                  },
                  {
                    name: 'USER_API_URL',
                    value: pulumi.interpolate`http://${userService}`,
                  },
                  {
                    name: 'OTEL_TRACES_EXPORTER',
                    value: 'otlp',
                  },
                  {
                    name: 'OTEL_EXPORTER_OTLP_PROTOCOL',
                    value: 'grpc',
                  },
                  {
                    name: 'OTEL_EXPORTER_OTLP_ENDPOINT',
                    value: otlpEndpoint,
                  },
                  {
                    name: 'OTEL_SERVICE_NAME',
                    value: srv,
                  },
                  // {
                  //   name: 'NODE_OPTIONS',
                  //   value:
                  //     '--require @opentelemetry/auto-instrumentations-node/register',
                  // },
                ],
                ports: [
                  {
                    containerPort: port,
                  },
                ],
              },
            ],
          },
        },
      },
    },
    { provider, dependsOn: [pushJob] }
  );
  /* Service */
  const service = new k8s.core.v1.Service(
    `${srv}-svc`,
    {
      spec: {
        ports: [
          {
            port: 80,
            targetPort: port,
          },
        ],
        selector: deploy.spec.apply((ob) => ob.selector.matchLabels),
        type: 'NodePort',
      },
    },
    { provider }
  );
  return { service };
};
