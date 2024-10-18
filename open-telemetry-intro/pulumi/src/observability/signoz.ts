import * as k8s from '@pulumi/kubernetes';

export const makeSignoz = ({ provider }: { provider: k8s.Provider }) => {
  const namespace = new k8s.core.v1.Namespace(
    'signoz',
    {
      metadata: {
        name: 'signoz',
      },
    },
    { provider }
  );
  const signoz = new k8s.helm.v4.Chart(
    'signoz',
    {
      namespace: namespace.metadata.name,
      repositoryOpts: {
        repo: 'https://charts.signoz.io',
      },
      chart: 'signoz',
    },
    { provider }
  );
};
