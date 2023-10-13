import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"


export class CertManagerComponent extends pulumi.ComponentResource {
    private namespace: k8s.core.v1.Namespace
    private chart: k8s.helm.v3.Release
    private secret: k8s.apiextensions.CustomResource
    private clusterIssuer: k8s.apiextensions.CustomResource

    constructor(
        name: string,
        args: {},
        opts?: pulumi.ComponentResourceOptions
    ) {
        super("htoh:index:CertManagerComponent", name, args, opts);

        this.namespace = new k8s.core.v1.Namespace("cert-manager", {
            metadata: {
                name: "cert-manager"
            }
        })
        this.chart = new k8s.helm.v3.Release("cert-manager", {
            chart: "cert-manager",
            namespace: this.namespace.metadata.name,
            version: "v1.13.0",
            repositoryOpts: {
                repo: "https://charts.jetstack.io",
            },
        })
        this.secret = new k8s.apiextensions.CustomResource("scw-secret-store", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ExternalSecret",
            metadata: {
                namespace: this.namespace.metadata.name,
                name: "azuredns-config",
            },
            spec: {
                "refreshInterval": "60m",
                "secretStoreRef": {
                    "name": "scw-secret-store",
                    "kind": "ClusterSecretStore"
                },
                "target": {
                    "name": "azuredns-config"
                },
                "data": [
                    {
                        "secretKey": "client-secret",
                        "remoteRef": {
                            "key": "id:7ac3fa4e-40c4-461f-9872-76e4d25693d4",
                            "version": "latest_enabled"
                        }
                    }
                ]
            }
        })
        this.clusterIssuer = new k8s.apiextensions.CustomResource("scw-secret-store", {
            apiVersion: "cert-manager.io/v1",
            kind: "ClusterIssuer",
            metadata: {
                namespace: this.namespace.metadata.name,
                name: "azuredns-config",
            },
            spec: {
                "acme": {
                    "email": "manhha@htoh.io",
                    "preferredChain": "",
                    "privateKeySecretRef": {
                        "name": "letsencrypt"
                    },
                    "server": "https://acme-v02.api.letsencrypt.org/directory",
                    "solvers": [
                        {
                            "dns01": {
                                "azureDNS": {
                                    "clientID": "c8d5b098-5728-4eaa-98e3-28a47bfdea9e",
                                    "clientSecretSecretRef": {
                                        "name": "azuredns-config",
                                        "key": "client-secret"
                                    },
                                    "subscriptionID": "a130654f-11e9-4af9-a215-a62b7dfcfc22",
                                    "tenantID": "16843612-824f-477b-a87b-20f98cf04416",
                                    "resourceGroupName": "rg-dns",
                                    "hostedZoneName": "htoh.app",
                                    "environment": "AzurePublicCloud"
                                }
                            }
                        }
                    ]
                }
            }
        }, {
            dependsOn: [this.chart, this.secret]
        })
    }
}