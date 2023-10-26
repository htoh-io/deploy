import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"

export class StaticServerComponent extends pulumi.ComponentResource {
    constructor(name: string, args: { namespace: k8s.core.v1.Namespace }, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:StaticServerComponent", name, args, opts);
        const stack = pulumi.getStack()

        const apiSecret = new k8s.apiextensions.CustomResource("static-server-secret", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ExternalSecret",
            metadata: {
                namespace: args.namespace.metadata.name,
                name: "static-server",
            },
            spec: {
                "refreshInterval": "60m",
                "secretStoreRef": {
                    "name": "scw-env-secret-store",
                    "kind": "ClusterSecretStore"
                },
                "target": {
                    "name": "static-server"
                },
                "dataFrom": [
                    {
                        "extract": {
                            "key": "path:/services/static-server"
                        }
                    }
                ]
            }
        })

        const appName = 'static-server'
        const service = new k8s.core.v1.Service(`${appName}`, {
            metadata: { name: appName, namespace: args.namespace.metadata.name },
            spec: {
                type: "ClusterIP",
                ports: [{ port: 80, targetPort: 80 }],
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
                            image: "ghcr.io/nginxinc/nginx-s3-gateway/nginx-oss-s3-gateway:latest",
                            ports: [{ containerPort: 8080 }],
                            env: [
                                {
                                    name: 'AWS_ACCESS_KEY_ID',
                                    valueFrom: {
                                        secretKeyRef: {
                                            key: "scw-access-key",
                                            name: "static-server"
                                        }
                                    }
                                },
                                {
                                    name: 'AWS_SECRET_ACCESS_KEY',
                                    valueFrom: {
                                        secretKeyRef: {
                                            key: "scw-secret-key",
                                            name: "static-server"
                                        }
                                    }
                                },
                                {
                                    name: 'ALLOW_DIRECTORY_LIST',
                                    value: "false"
                                },
                                {
                                    name: 'S3_BUCKET_NAME',
                                    value: `static-htoh-${stack}`
                                },
                                {
                                    name: 'S3_REGION',
                                    value: `fr-par`
                                },
                                {
                                    name: 'S3_SERVER',
                                    value: `s3.fr-par.scw.cloud`
                                },
                                {
                                    name: 'S3_SERVER_PROTO',
                                    value: `https`
                                },
                                {
                                    name: 'S3_SERVER_PORT',
                                    value: `443`
                                },
                                {
                                    name: 'S3_STYLE',
                                    value: `path`
                                },
                                {
                                    name: 'AWS_SIGS_VERSION',
                                    value: `4`
                                },
                            ]
                        }],
                    },
                },
            },
        });
    }
}