import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as fs from 'fs'
import path = require('path')

export class OpenTelemetryComponent extends pulumi.ComponentResource {
    constructor(name: string, args: {
        version: pulumi.Input<string>
    }, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:OpenTelemetryComponent", name, args, opts);

        const namespace = new k8s.core.v1.Namespace("opentelemetry", {
            metadata: {
                name: "opentelemetry",
                labels: {
                    "secret.htoh.io/required": "true"
                }
            }
        })

        const secret = new k8s.apiextensions.CustomResource("opentelemetry", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ExternalSecret",
            metadata: {
                namespace: namespace.metadata.name,
                name: "opentelemetry",
            },
            spec: {
                "refreshInterval": "2m",
                "secretStoreRef": {
                    "name": "scw-ops-secret-store",
                    "kind": "ClusterSecretStore"
                },
                "target": {
                    "name": "opentelemetry"
                },
                "dataFrom": [
                    {
                        "extract": {
                            "key": "path:/kubernetes/opentelemetry"
                        }
                    }
                ]
            }
        })

        const chart = new k8s.helm.v3.Release("opentelemetry-operator", {
            chart: "opentelemetry-operator",
            namespace: namespace.metadata.name,
            repositoryOpts: {
                repo: "https://open-telemetry.github.io/opentelemetry-helm-charts",
            },
            values: {
                "admissionWebhooks.certManager.enabled": "false",
                "admissionWebhooks.certManager.autoGenerateCert": "true"
            },
            version: args.version
        }, {
            dependsOn: [secret]
        })

        const grafanaConfig: string = fs.readFileSync(path.resolve(__dirname, `grafana.yaml`),'utf8')
        const collector = new k8s.apiextensions.CustomResource("opentelemetry-collector", {
            apiVersion: "opentelemetry.io/v1alpha1",
            kind: "OpenTelemetryCollector",
            metadata: {
                namespace: namespace.metadata.name,
                name: "central",
            },
            spec: {
                mode: "daemonset",
                image: "otel/opentelemetry-collector-contrib",
                env: [
                    {
                        name: "GRAFANA_CLOUD_KEY",
                        valueFrom: {
                            secretKeyRef: {
                                key: "grafana-cloud-key",
                                name: "opentelemetry"
                            }
                        }
                    },
                    {
                        name: "GRAFANA_CLOUD_SECRET",
                        valueFrom: {
                            secretKeyRef: {
                                key: "grafana-cloud-secret",
                                name: "opentelemetry"
                            }
                        }
                    }
                ],
                config: grafanaConfig
            }
        })
    }
}