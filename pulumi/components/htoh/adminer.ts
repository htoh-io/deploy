import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"

export class AdminerComponent extends pulumi.ComponentResource {
    constructor(name: string, args: { namespace: k8s.core.v1.Namespace }, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:AdminerComponent", name, args, opts);
        const stack = pulumi.getStack()

        const appName = 'adminer'
        const service = new k8s.core.v1.Service(`${appName}`, {
            metadata: { name: appName, namespace: args.namespace.metadata.name },
            spec: {
                type: "ClusterIP",
                ports: [{ port: 80, targetPort: 8080 }],
                selector: { app: appName },
            },
        });
        const deployment = new k8s.apps.v1.Deployment(`${appName}`, {
            metadata: { name: appName, namespace: args.namespace.metadata.name },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: { app: appName },
                },
                template: {
                    metadata: {
                        labels: { app: appName },
                    },
                    spec: {
                        containers: [{
                            name: appName,
                            image: "adminer",
                            ports: [{ containerPort: 8080 }],
                        }],
                    },
                },
            },
        });
    }
}