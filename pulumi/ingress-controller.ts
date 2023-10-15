import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as azure from "@pulumi/azure"

export class IngressControllerComponent extends pulumi.ComponentResource {
    private service: k8s.core.v1.Service

    constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:IngressControllerComponent", name, args, opts);

        const ingressNginx = new k8s.kustomize.Directory("scalewayIngressNginx", {
            directory: "https://github.com/kubernetes/ingress-nginx/tree/controller-v1.9.3/deploy/static/provider/scw"
        })

        this.service = k8s.core.v1.Service.get("ingressNginxService", "ingress-nginx/ingress-nginx-controller", {
            dependsOn: [ingressNginx]
        })

        const controllerIp = this.service.status.loadBalancer.ingress[0].ip
        const zone = azure.dns.Zone.get(
            "htoh.app",
            "/subscriptions/a130654f-11e9-4af9-a215-a62b7dfcfc22/resourceGroups/rg-dns/providers/Microsoft.Network/dnsZones/htoh.app"
        )

        new azure.dns.ARecord("wildcard-record", {
            name: "*.dev",
            zoneName: zone.name,
            resourceGroupName: zone.resourceGroupName,
            ttl: 300,
            records: [controllerIp],
        })

        new azure.dns.ARecord("api-record", {
            name: "api.dev",
            zoneName: zone.name,
            resourceGroupName: zone.resourceGroupName,
            ttl: 300,
            records: [controllerIp],
        })

        // ZeroSSL verification
        new azure.dns.CNameRecord("zerossl-record", {
            name: "_432C6D2A9CAB9F1C4003002249EA0A30.api.dev",
            zoneName: zone.name,
            resourceGroupName: zone.resourceGroupName,
            ttl: 300,
            record: "A27D0810F285D59468E304146312B2ED.471558341C9F67DB4002A5244029DDCE.bdba85485860870.comodoca.com",
        })

        // Now let's deploy two applications which are identical except for the
        // names. We will later configure the ingress to direct traffic to them,
        // one domain name per application instance.
        const appName = 'hello-k8s'
        const appSvc = new k8s.core.v1.Service(`${appName}-svc`, {
            metadata: { name: appName, },
            spec: {
                type: "ClusterIP",
                ports: [{ port: 80, targetPort: 8080 }],
                selector: { app: appName },
            },
        });
        const appDep = new k8s.apps.v1.Deployment(`${appName}-dep`, {
            metadata: { name: appName },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: { app: appName },
                },
                template: {
                    metadata: {
                        labels: { app: appName },
                    },
                    spec: {
                        containers: [{
                            name: appName,
                            image: "paulbouwer/hello-kubernetes:1.8",
                            ports: [{ containerPort: 8080 }],
                            env: [{ name: "MESSAGE", value: "Hello K8s!" }],
                        }],
                    },
                },
            },
        });

        // Next, expose the app using an Ingress.
        const appIngress = new k8s.networking.v1.Ingress(`${appName}-ingress`, {
            metadata: {
                name: "hello-k8s-ingress",
                annotations: {
                    "kubernetes.io/ingress.class": "nginx",
                },
            },
            spec: {
                ingressClassName: "nginx",
                tls: [
                    {
                        hosts: [
                            "api.dev.htoh.app"
                        ],
                        secretName: "tls-certificate"
                    }
                ],
                rules: [
                    {
                        host: "api.dev.htoh.app",
                        http: {
                            paths: [{
                                pathType: "Prefix",
                                path: "/",
                                backend: {
                                    service: {
                                        name: appName,
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