import * as pulumi from "@pulumi/pulumi"
import * as k8s from "@pulumi/kubernetes"
import { ExternalSecretsComponent } from './external-secrets'
import { CertManagerComponent } from './cert-manager'
import { IngressControllerComponent } from './ingress-controller'

const config = new pulumi.Config()
config.requireSecret("ssmAccessKey")

const externalSecrets = new ExternalSecretsComponent("external-secrets", {
    accessKey: config.requireSecret("ssmAccessKey").apply(toBase64),
    secretKey: config.requireSecret("ssmSecretKey").apply(toBase64),
});

const certManager = new CertManagerComponent("cert-manager", {}, {
    dependsOn: [externalSecrets]
})

const ingressController = new IngressControllerComponent("ingress-nginx", {}, {
    dependsOn: [externalSecrets]
})

function toBase64(data: string): string {
    return Buffer.from(data).toString('base64')
}
