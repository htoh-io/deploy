import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as azure from "@pulumi/azure"
import { AdminerComponent } from './adminer'
import { CloudflaredComponent } from './cloudflared'
import { HtohApiComponent } from './htoh-api'

export class HtohComponent extends pulumi.ComponentResource {

    constructor(name: string, args: {
        zone: azure.dns.Zone
    }, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:HtohComponent", name, args, opts);
        const zone = args.zone;
        const stack = pulumi.getStack()

        const namespace = new k8s.core.v1.Namespace("htoh", {
            metadata: {
                name: "htoh",
                labels: {
                    "secret.htoh.io/required": "true",
                    "env.htoh.io": stack
                }
            }
        })

        const service = k8s.core.v1.Service.get("ingress-nginx-service", "ingress-nginx/ingress-nginx-controller", {})

        new azure.dns.CNameRecord("wildcard-record", {
            name: `*.${stack}`,
            zoneName: zone.name,
            resourceGroupName: zone.resourceGroupName,
            ttl: 300,
            record: service.status.loadBalancer.ingress[0].hostname,
        })

        const containerRegistrySecret = new k8s.apiextensions.CustomResource("scw-container-registry", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ExternalSecret",
            metadata: {
                namespace: namespace.metadata.name,
                name: "scw-container-registry",
            },
            spec: {
                "refreshInterval": "60m",
                "secretStoreRef": {
                    "name": "scw-ops-secret-store",
                    "kind": "ClusterSecretStore"
                },
                "target": {
                    "template": {
                        "type": "kubernetes.io/dockerconfigjson",
                        "data": {
                            ".dockerconfigjson": "{{ .credentials | toString }}"
                        }
                    },
                    "name": "scw-container-registry"
                },
                "data": [
                    {
                        "secretKey": "credentials",
                        "remoteRef": {
                            "key": "path:/kubernetes/container-registry",
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
                            `*.${stack}.htoh.app`,
                        ],
                        secretName: `tls-certs-${stack}`
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
                                        name: "htoh-api",
                                        port: { number: 80 },
                                    },
                                },
                            }],
                        },
                    }
                ],
            },
        });

        new HtohApiComponent("htoh-api", { namespace: namespace })

        new CloudflaredComponent("cloudflared", { namespace: namespace })
    }
}