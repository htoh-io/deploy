import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"

export class AdminerAppComponent extends pulumi.ComponentResource {
    constructor(name: string, args: { namespace: k8s.core.v1.Namespace }, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:AdminerAppComponent", name, args, opts);
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

        const ingress = new k8s.networking.v1.Ingress(`ingress-adminer`, {
            metadata: {
                name: "ingress-adminer",
                namespace: args.namespace.metadata.name,
                annotations: {
                    "kubernetes.io/ingress.class": "nginx",
                    "cert-manager.io/cluster-issuer": "letsencrypt",
                    "nginx.ingress.kubernetes.io/ssl-redirect": "true",
                    "nginx.ingress.kubernetes.io/proxy-body-size": "8m"
                },
            },
            spec: {
                ingressClassName: "nginx",
                tls: [
                    {
                        hosts: [
                            `adminer.${stack}.htoh.app`,
                        ],
                        secretName: "tls-secret"
                    }
                ],
                rules: [
                    {
                        host: `adminer.${stack}.htoh.app`,
                        http: {
                            paths: [{
                                pathType: "Prefix",
                                path: "/",
                                backend: {
                                    service: {
                                        name: "adminer",
                                        port: { number: 80 },
                                    },
                                },
                            }],
                        },
                    },
                ],
            },
        });
    }
}