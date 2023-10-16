import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as certmanager from "@pulumi/kubernetes-cert-manager"


export class CertManagerComponent extends pulumi.ComponentResource {
    // private namespace: k8s.core.v1.Namespace
    // private chart: k8s.helm.v3.Release
    // private secret: k8s.apiextensions.CustomResource
    // private clusterIssuer: k8s.apiextensions.CustomResource
    //private manager: certmanager.CertManager

    constructor(
        name: string,
        args: {},
        opts?: pulumi.ComponentResourceOptions
    ) {
        super("htoh:index:CertManagerComponent", name, args, opts);

        const namespace = new k8s.core.v1.Namespace("cert-manager", {
            metadata: {
                name: "cert-manager",
                annotations: {
                    "certmanager.k8s.io/disable-validation": "true"
                }
            }
        })
        const certManager = new certmanager.CertManager("cert-manager", {
            installCRDs: true,
            helmOptions: {
                namespace: namespace.metadata.name,
                version: "v1.13.1"
            }
        })

        const secret = new k8s.apiextensions.CustomResource("azuredns-config", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ExternalSecret",
            metadata: {
                namespace: "cert-manager",
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
        }, {
            dependsOn: [certManager]
        })

        const clusterIssuer = new k8s.apiextensions.CustomResource("letsencrypt", {
            apiVersion: "cert-manager.io/v1",
            kind: "ClusterIssuer",
            metadata: {
                namespace: name,
                name: "letsencrypt",
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
            dependsOn: [certManager, secret]
        })
    }
}