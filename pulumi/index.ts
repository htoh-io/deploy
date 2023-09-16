import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as fs from "fs";
import { ExternalSecretsComponent } from './external-secrets'


const externalSecrets = new ExternalSecretsComponent("external-secrets", {
    accessKey: toBase64(readFile("/Users/manhha/.kube/external-secrets/prd/.access-key")),
    secretKey: toBase64(readFile("/Users/manhha/.kube/external-secrets/prd/.secret-key")),
});

function readFile(path: string): string {
    return fs.readFileSync(path).toString()
}

function toBase64(data: string): string {
    return Buffer.from(data).toString('base64')
}