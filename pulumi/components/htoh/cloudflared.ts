import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as fs from 'fs'
import path = require('path')

export class CloudflaredComponent extends pulumi.ComponentResource {
    constructor(name: string, args: { namespace: k8s.core.v1.Namespace }, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:CloudflaredComponent", name, args, opts);
        const stack = pulumi.getStack()

        const appName = 'cloudflared'

        const config: string = fs.readFileSync(path.resolve(__dirname, `cloudflared-config.yaml`), 'utf8')
        const configMap = new k8s.core.v1.ConfigMap(appName, {
            metadata: {
                namespace: args.namespace.metadata.name,
                name: "cloudflared",
            },
            data: {
                'config.yaml': config
            }
        })

        const secret = new k8s.apiextensions.CustomResource("cloudflared", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ExternalSecret",
            metadata: {
                namespace: args.namespace.metadata.name,
                name: "cloudflared",
            },
            spec: {
                "refreshInterval": "60m",
                "secretStoreRef": {
                    "name": "scw-ops-secret-store",
                    "kind": "ClusterSecretStore"
                },
                "target": {
                    "name": "cloudflared"
                },
                "data": [
                    {
                        "secretKey": "tunnel-token",
                        "remoteRef": {
                            "key": "path:/kubernetes/cloudflared",
                            "version": "latest_enabled"
                        }
                    }
                ]
            }
        })

        const deployment = new k8s.apps.v1.Deployment(appName, {
            metadata: { name: appName, namespace: args.namespace.metadata.name },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: { "app.kubernetes.io/name": appName },
                },
                template: {
                    metadata: {
                        labels: { "app.kubernetes.io/name": appName },
                    },
                    spec: {
                        containers: [{
                            name: appName,
                            image: "cloudflare/cloudflared:2023.8.2",
                            imagePullPolicy: "IfNotPresent",
                            volumeMounts: [{
                                name: "config",
                                mountPath: "/etc/cloudflared/",
                                readOnly: true
                            }],
                            args: [
                                "tunnel",
                                // "--loglevel",
                                // "debug",
                                // "--transport-loglevel",
                                // "debug",
                                "--protocol",
                                "quic",
                                "run",
                            ],
                            env: [
                                {
                                    name: 'TUNNEL_TOKEN',
                                    valueFrom: {
                                        secretKeyRef: {
                                            key: "tunnel-token",
                                            name: "cloudflared"
                                        }
                                    }
                                }
                            ],
                        }],

                        volumes: [{
                            name: "config",
                            configMap: {
                                name: "cloudflared",
                                items: [{
                                    key: "config.yaml",
                                    path: "config.yaml"
                                }]
                            }
                        }]
                    },
                },
            },
        });
    }
}