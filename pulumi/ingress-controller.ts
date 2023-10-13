import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as nginx from "@pulumi/kubernetes-ingress-nginx";

export class IngressControllerComponent extends pulumi.ComponentResource {
    private namespace: k8s.core.v1.Namespace
    private chart: k8s.helm.v3.Release

    constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:IngressControllerComponent", name, args, opts);

        this.namespace = new k8s.core.v1.Namespace(name, {
            metadata: {
                name: name
            }
        })

        this.chart = new k8s.helm.v3.Release(name, {
            chart: "ingress-nginx",
            namespace: this.namespace.metadata.name,
            values: {
                controller: {
                    service: {
                        annotations: {
                            "service.beta.kubernetes.io/scw-loadbalancer-proxy-protocol-v2": "true",
                            "service.beta.kubernetes.io/scw-loadbalancer-use-hostname": "true"
                        }
                    }
                }
            },
            repositoryOpts:{
                repo: "https://kubernetes.github.io/ingress-nginx",
            },
        })
    }
}