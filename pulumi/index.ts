import * as pulumi from "@pulumi/pulumi"
import * as azure from "@pulumi/azure"
import { 
    ExternalSecretsComponent,
    CertManagerComponent,
    IngressControllerComponent,
    OpenTelemetryComponent,
    HtohAppComponent
} from './components'

const config = new pulumi.Config("htoh")

const externalSecrets = new ExternalSecretsComponent("external-secrets", {
    version: config.require('external-secrets-version'),
    accessKey: config.requireSecret("ssm-access-key").apply(toBase64),
    secretKey: config.requireSecret("ssm-secret-key").apply(toBase64),
});

const certManager = new CertManagerComponent("cert-manager", {
    version: `v${config.require('cert-manager-version')}`
}, {
    dependsOn: [externalSecrets]
})

const ingressController = new IngressControllerComponent("ingress-nginx", {
    version: config.require("ingress-version"),
}, {
    dependsOn: [externalSecrets]
})

const openTelemetry = new OpenTelemetryComponent("open-telemetry", {
    version: config.require('opentelemetry-version')
}, 
{
    dependsOn: [certManager, externalSecrets]
})

const zone = azure.dns.Zone.get(
    "htoh.app",
    config.require("zone-htoh-app")
)

// This can fail if the ingressNginx component is not yet completely deployed
// which often take some times
// Workaround: comment the lines below 
const htohApp = new HtohAppComponent("htoh-app", {
    zone: zone
}, {
    dependsOn: [ingressController, openTelemetry]
})

function toBase64(data: string): string {
    return Buffer.from(data).toString('base64')
}
