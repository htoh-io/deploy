import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"

export class ExternalSecretsComponent extends pulumi.ComponentResource {
    constructor(
        name: string, 
        args: {
            version: pulumi.Input<string>,
            accessKey: pulumi.Input<string>, 
            secretKey: pulumi.Input<string>
        }, 
        opts?: pulumi.ComponentResourceOptions
    ) {
        // By calling super(), we ensure any instantiation of this class
        // inherits from the ComponentResource class so we don't have to
        // declare all the same things all over again.
        super("htoh:index:ExternalSecretsComponent", name, args, opts);

        const namespace = new k8s.core.v1.Namespace("external-secrets", {
            metadata: {
                name: "external-secrets"
            }
        })

        const chart = new k8s.helm.v3.Release("external-secrets", {
            chart: "external-secrets",
            namespace: namespace.metadata.name,
            repositoryOpts:{
                repo: "https://charts.external-secrets.io",
            },
            version: args.version
        })
        
        const secret = new k8s.core.v1.Secret("scwsm-secret", {
            metadata: {
                namespace: namespace.metadata.name,
                name: "scwsm-secret"
            },
            type: "Opaque",
            data: {
                "access-key": args.accessKey,
                "secret-key": args.secretKey,
            },
        })

        const clusterSecretStore = new k8s.apiextensions.CustomResource("scw-secret-store", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ClusterSecretStore",
            metadata: {
                name: "scw-secret-store",
            },
            spec: {
                "provider": {
                    "scaleway": {
                        "region": "fr-par",
                        "projectId": "9c3369b0-7bf1-4453-a56a-1e5c7ff0fa97",
                        "accessKey": {
                            "secretRef": {
                                "namespace": "external-secrets",
                                "name": "scwsm-secret",
                                "key": "access-key"
                            }
                        },
                        "secretKey": {
                            "secretRef": {
                                "namespace": "external-secrets",
                                "name": "scwsm-secret",
                                "key": "secret-key"
                            }
                        }
                    }
                },
                "conditions": [
                    {
                        "namespaceSelector": {
                            "matchLabels": {
                                "secret.htoh.io/required": "true"
                            }
                        }
                    },
                    {
                        "namespaces": [
                            "cert-manager"
                        ]
                    }
                ]
            }
        }, {
            dependsOn: [chart, secret]
        })

        const scwOpsSecretStore = new k8s.apiextensions.CustomResource("scw-ops-secret-store", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ClusterSecretStore",
            metadata: {
                name: "scw-ops-secret-store",
            },
            spec: {
                "provider": {
                    "scaleway": {
                        "region": "fr-par",
                        "projectId": "3dc537aa-866e-4b49-92d4-26936141850e",
                        "accessKey": {
                            "secretRef": {
                                "namespace": "external-secrets",
                                "name": "scwsm-secret",
                                "key": "access-key"
                            }
                        },
                        "secretKey": {
                            "secretRef": {
                                "namespace": "external-secrets",
                                "name": "scwsm-secret",
                                "key": "secret-key"
                            }
                        }
                    }
                },
                "conditions": [
                    {
                        "namespaceSelector": {
                            "matchLabels": {
                                "secret.htoh.io/required": "true"
                            }
                        }
                    },
                    {
                        "namespaces": [
                            "cert-manager"
                        ]
                    }
                ]
            }
        }, {
            dependsOn: [chart, secret]
        })
    }   
}