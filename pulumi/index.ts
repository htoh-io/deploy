import * as pulumi from "@pulumi/pulumi"
import * as azure from "@pulumi/azure"
import { 
    ExternalSecretsComponent,
    CertManagerComponent,
    IngressControllerComponent,
    OpenTelemetryComponent
} from './components'

const config = new pulumi.Config("htoh")

const externalSecrets = new ExternalSecretsComponent("external-secrets", {
    accessKey: config.requireSecret("ssm-access-key").apply(toBase64),
    secretKey: config.requireSecret("ssm-secret-key").apply(toBase64),
});

const certManager = new CertManagerComponent("cert-manager", {}, {
    dependsOn: [externalSecrets]
})

const zone = azure.dns.Zone.get(
    "htoh.app",
    config.require("zone-htoh-app")
)

const ingressController = new IngressControllerComponent("ingress-nginx", {
    ingressVersion: config.require("ingress-version"),
    zone: zone
}, {
    dependsOn: [externalSecrets]
})

const openTelemetry = new OpenTelemetryComponent("open-telemetry", {}, 
{
    dependsOn: [certManager, externalSecrets]
})

function toBase64(data: string): string {
    return Buffer.from(data).toString('base64')
}
