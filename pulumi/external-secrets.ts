import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"

export class ExternalSecretsComponent extends pulumi.ComponentResource {
    private namespace: k8s.core.v1.Namespace
    private chart: k8s.helm.v3.Release
    private secret: k8s.core.v1.Secret
    private clusterSecretStore: k8s.apiextensions.CustomResource

    constructor(
        name: string, 
        args: {
            accessKey: pulumi.Input<string>, 
            secretKey: pulumi.Input<string>
        }, 
        opts?: pulumi.ComponentResourceOptions
    ) {
        // By calling super(), we ensure any instantiation of this class
        // inherits from the ComponentResource class so we don't have to
        // declare all the same things all over again.
        super("htoh:index:ExternalSecretsComponent", name, args, opts);

        this.namespace = new k8s.core.v1.Namespace("external-secrets", {
            metadata: {
                name: "external-secrets"
            }
        })

        this.chart = new k8s.helm.v3.Release("external-secrets", {
            chart: "external-secrets",
            namespace: this.namespace.metadata.name,
            repositoryOpts:{
                repo: "https://charts.external-secrets.io",
            },
        })
        
        this.secret = new k8s.core.v1.Secret("scwsm-secret", {
            metadata: {
                namespace: this.namespace.metadata.name,
                name: "scwsm-secret"
            },
            type: "Opaque",
            data: {
                "access-key": args.accessKey,
                "secret-key": args.secretKey,
            },
        })

        this.clusterSecretStore = new k8s.apiextensions.CustomResource("scw-secret-store", {
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
            dependsOn: [this.chart, this.secret]
        })
    }   
}