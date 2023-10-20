import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"
import path = require('path')

export class IngressControllerComponent extends pulumi.ComponentResource {

    constructor(name: string, args: {
        version: pulumi.Input<string>
    }, opts?: pulumi.ComponentResourceOptions) {
        super("htoh:index:IngressControllerComponent", name, args, opts);

        const ingressNginx = new k8s.kustomize.Directory("scaleway-ingress-nginx", {
            directory: path.resolve(__dirname),
        })
    }
}