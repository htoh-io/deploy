import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as fs from 'fs'

export class OpenTelemetryComponent extends pulumi.ComponentResource {
    constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:OpenTelemetryComponent", name, args, opts);
        const currentDirectory = `./opentelemetry`

        const namespace = new k8s.core.v1.Namespace("opentelemetry", {
            metadata: {
                name: "opentelemetry",
                labels: {
                    "secret.htoh.io/required": "true"
                }
            }
        })

        const secret = new k8s.apiextensions.CustomResource("grafana-cloud-secret", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ExternalSecret",
            metadata: {
                namespace: namespace.metadata.name,
                name: "opentelemetry-collector",
            },
            spec: {
                "refreshInterval": "60m",
                "secretStoreRef": {
                    "name": "scw-secret-store",
                    "kind": "ClusterSecretStore"
                },
                "target": {
                    "name": "opentelemetry-collector"
                },
                "data": [
                    {
                        "secretKey": "grafana-cloud-secret-key",
                        "remoteRef": {
                            "key": "id:a4759563-7e68-4bab-bd00-004f9568599c",
                            "version": "latest_enabled"
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
            }
        }, {
            dependsOn: [secret]
        })

        const grafanaConfig: string = fs.readFileSync(`${currentDirectory}/grafana.yaml`,'utf8')
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
                        name: "GRAFANA_CLOUD_SECRET_KEY",
                        valueFrom: {
                            secretKeyRef: {
                                key: "grafana-cloud-secret-key",
                                name: "opentelemetry-collector"
                            }
                        }
                    }
                ],
                config: grafanaConfig
            }
        })
    }
}