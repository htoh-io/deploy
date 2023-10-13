import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as azure from "@pulumi/azure"

export class IngressControllerComponent extends pulumi.ComponentResource {

    constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:IngressControllerComponent", name, args, opts);

        const namespace = new k8s.core.v1.Namespace(name, {
            metadata: {
                name: name
            }
        })

        const chart = new k8s.helm.v3.Release(name, {
            chart: "ingress-nginx",
            namespace: namespace.metadata.name,
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
            repositoryOpts: {
                repo: "https://kubernetes.github.io/ingress-nginx",
            },
        })

        const controllerService = chart.resourceNames['Service/v1']
            .apply((services: string[]) => services.find(s => s.endsWith('controller'))!)

        const service = k8s.core.v1.Service
            .get("ingress-nginx-controller", controllerService, {})
            .status.loadBalancer.ingress.apply(ingress => ingress[0].hostname)
        const zone = azure.dns.Zone.get("htoh.app", "/subscriptions/a130654f-11e9-4af9-a215-a62b7dfcfc22/resourceGroups/rg-dns/providers/Microsoft.Network/dnsZones/htoh.app")

        new azure.dns.CNameRecord("wildcard-dev", {
            name: "*.dev",
            zoneName: zone.name,
            resourceGroupName: zone.resourceGroupName,
            ttl: 300,
            record: service,
        })
    }
}