import { homedir } from 'node:os';
import { LocalWorkspace } from '@pulumi/pulumi/automation';
import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import { execSync } from 'node:child_process';
import { makeUserService } from './app/user';
import { makePostService } from './app/post';
import { makeOpenTelemetry } from './observability/openTelemetry';
import { makeSignoz } from './observability/signoz';

(async () => {
  const localWorkspace = await LocalWorkspace.createOrSelectStack(
    {
      projectName: 'open-telemetry-intro',
      stackName: 'local',
      program: async () => {
        /* Kubernetes Provider */
        const provider = new k8s.Provider('provider', {
          context: 'minikube',
        });
        makeSignoz({ provider });
        const { otlpGrpcEndpoint } = makeOpenTelemetry({ provider });
        const { service: userService } = makeUserService({
          provider,
          otlpEndpoint: otlpGrpcEndpoint,
        });
        makePostService({
          provider,
          userService: userService.metadata.name,
          otlpEndpoint: otlpGrpcEndpoint,
        });

        /**
         * open telemetry chart
         * - open telemetry collector
         * Signoz
         * - chart ?
         * Jaeger
         * - Chart ? Deploy ?
         */
      },
    },
    {
      envVars: {
        // ...minikubeEnv,
        PULUMI_CONFIG_PASSPHRASE: 'passphrase',
        PULUMI_BACKEND_URL: `file://${homedir()}`,
      },
    }
  );
  /* Disable default kubernetes provider */
  await localWorkspace.setConfig('pulumi:disable-default-providers', {
    value: JSON.stringify(['kubernetes']),
  });

  await localWorkspace.up({
    onOutput(out) {
      console.log(out);
    },
  });
})();
