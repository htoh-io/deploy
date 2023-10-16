import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import * as azure from "@pulumi/azure"

export class IngressControllerComponent extends pulumi.ComponentResource {

    constructor(name: string, args: {
        ingressVersion: pulumi.Input<string>,
        zone: azure.dns.Zone
    }, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:IngressControllerComponent", name, args, opts);

        const zone = args.zone

        const ingressNginx = new k8s.kustomize.Directory("scaleway-ingress-nginx", {
            directory: `https://github.com/kubernetes/ingress-nginx/tree/controller-v${args.ingressVersion}/deploy/static/provider/scw`
        })

        const service = k8s.core.v1.Service.get("ingress-nginx-service", "ingress-nginx/ingress-nginx-controller", {
            dependsOn: [ingressNginx]
        })

        const controllerIp = service.status.loadBalancer.ingress[0].ip
        
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

        const appIngress = new k8s.networking.v1.Ingress(`${appName}-ingress`, {
            metadata: {
                name: "hello-k8s-ingress",
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
                            "api.dev.htoh.app"
                        ],
                        secretName: "tls-secret"
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