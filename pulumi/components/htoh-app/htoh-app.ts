import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as azure from "@pulumi/azure"

export class HtohAppComponent extends pulumi.ComponentResource {
    constructor(name: string, args: {
        zone: azure.dns.Zone
    }, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:HtohAppComponent", name, args, opts);
        const zone = args.zone;
        const stack = pulumi.getStack()

        const namespace = new k8s.core.v1.Namespace("htoh", {
            metadata: {
                name: "htoh",
                labels: {
                    "secret.htoh.io/required": "true"
                }
            }
        })

        const service = k8s.core.v1.Service.get("ingress-nginx-service", "ingress-nginx/ingress-nginx-controller", {})
        const controllerIp = service.status.loadBalancer.ingress[0].ip

        new azure.dns.ARecord("wildcard-record", {
            name: `*.${stack}`,
            zoneName: zone.name,
            resourceGroupName: zone.resourceGroupName,
            ttl: 300,
            records: [controllerIp],
        })

        new azure.dns.ARecord("api-record", {
            name: `api.${stack}`,
            zoneName: zone.name,
            resourceGroupName: zone.resourceGroupName,
            ttl: 300,
            records: [controllerIp],
        })

        const secret = new k8s.apiextensions.CustomResource("registry-credential", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ExternalSecret",
            metadata: {
                namespace: namespace.metadata.name,
                name: "registry-credential",
            },
            spec: {
                "refreshInterval": "60m",
                "secretStoreRef": {
                    "name": "scw-secret-store",
                    "kind": "ClusterSecretStore"
                },
                "target": {
                    "template": {
                        "type": "kubernetes.io/dockerconfigjson",
                        "data": {
                            ".dockerconfigjson": "{{ .registrycredential | toString }}"
                        }
                    },
                    "name": "registry-credential"
                },
                "data": [
                    {
                        "secretKey": "registrycredential",
                        "remoteRef": {
                            "key": "name:registry-credential",
                            "version": "latest_enabled"
                        }
                    }
                ]
            }
        })

        const appIngress = new k8s.networking.v1.Ingress(`ingress-api`, {
            metadata: {
                name: "ingress-api",
                namespace: namespace.metadata.name,
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
                            `api.${stack}.htoh.app`
                        ],
                        secretName: "tls-secret"
                    }
                ],
                rules: [
                    {
                        host: `api.${stack}.htoh.app`,
                        http: {
                            paths: [{
                                pathType: "Prefix",
                                path: "/",
                                backend: {
                                    service: {
                                        name: "demo-otel",
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