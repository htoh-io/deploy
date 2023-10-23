import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as azure from "@pulumi/azure"
import { AdminerComponent } from './adminer'
import { CloudflaredComponent } from './cloudflared'

export class HtohApiComponent extends pulumi.ComponentResource {

    constructor(name: string, args: {
        namespace: k8s.core.v1.Namespace
    }, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:HtohApiComponent", name, args, opts);
    
        const apiSecret = new k8s.apiextensions.CustomResource("htoh-api-secret", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ExternalSecret",
            metadata: {
                namespace: args.namespace.metadata.name,
                name: "htoh-api",
            },
            spec: {
                "refreshInterval": "60m",
                "secretStoreRef": {
                    "name": "scw-env-secret-store",
                    "kind": "ClusterSecretStore"
                },
                "target": {
                    "name": "htoh-api"
                },
                "dataFrom": [
                    {
                        "extract": {
                            "key": "path:/services/htoh-api"
                        }
                    }
                ]
            }
        })
    }
}