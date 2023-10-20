import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as certmanager from "@pulumi/kubernetes-cert-manager"

export class CertManagerComponent extends pulumi.ComponentResource {

    constructor(
        name: string,
        args: {
            azureClientId: pulumi.Input<string>,
            useLetsEncryptStaging: pulumi.Input<boolean>,
            version: pulumi.Input<string>
        },
        opts?: pulumi.ComponentResourceOptions
    ) {
        super("htoh:index:CertManagerComponent", name, args, opts);

        const namespace = new k8s.core.v1.Namespace("cert-manager", {
            metadata: {
                name: "cert-manager",
                annotations: {
                    "certmanager.k8s.io/disable-validation": "true"
                },
                labels: {
                    "secret.htoh.io/required": "true"
                }
            }
        })
        const certManager = new certmanager.CertManager("cert-manager", {
            installCRDs: true,
            helmOptions: {
                namespace: namespace.metadata.name,
                version: args.version
            }
        })


        const secret = new k8s.apiextensions.CustomResource("cert-manager", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ExternalSecret",
            metadata: {
                namespace: "cert-manager",
                name: "cert-manager",
            },
            spec: {
                "refreshInterval": "60m",
                "secretStoreRef": {
                    "name": "scw-ops-secret-store",
                    "kind": "ClusterSecretStore"
                },
                "target": {
                    "name": "cert-manager"
                },
                "dataFrom": [
                    {
                        "extract": {
                            "key": "path:/kubernetes/cert-manager"
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
                    // "preferredChain": "",
                    "privateKeySecretRef": {
                        "name": "letsencrypt"
                    },
                    "server": args.useLetsEncryptStaging ?
                        "https://acme-staging-v02.api.letsencrypt.org/directory"
                      : "https://acme-v02.api.letsencrypt.org/directory",
                    "solvers": [
                        {
                            "dns01": {
                                "azureDNS": {
                                    "clientID": args.azureClientId,
                                    "clientSecretSecretRef": {
                                        "name": "cert-manager",
                                        "key": "azure-dns-client-secret"
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