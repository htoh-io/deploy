## Prepare a new Kubernetes environment

1. Install external-secrets
2. Install cert-manager
3. Install ingress-nginx
4. Install Open Telemetry operator then collector
5. Deploy your application

## Install External Secrets

- Create an API key for Kubernetes application. Assign its policy with permission SecretManagerFullAccess (SecretManagerReadOnly doesn't seem to work).
- Create a [K8s secret with that API key](https://www.scaleway.com/en/docs/tutorials/external-secrets/#create-a-secret-containing-your-scaleway-api-key-information), it could be in the external-secrets or default namespace.

```bash
kubectl create secret generic scwsm-secret --namespace external-secrets --from-file=./access-key --from-file=./secret-key
```

- Install the Helmchart

```bash
helm repo add external-secrets https://charts.external-secrets.io

helm install external-secrets \
   external-secrets/external-secrets \
    -n external-secrets \
    --create-namespace \
    --set installCRDs=true
```

- Create the ClusterSecretStore for Scaleway with Kustomize. At the moment the secret refs are not working with this error "when using a ClusterSecretStore, namespaces must be explicitly set". There is a [related issue on Github](https://github.com/external-secrets/external-secrets/issues/2246). The current workaround is to not use secret ref and waiting for the fix.

Gotchas;
- Secrets in Scaleway are referred by ID which is not very good but there is no other option.
- We can trigger a secret refresh: https://external-secrets.io/v0.8.1/introduction/faq/

## Install Cert Manager

### Troubleshooting
- [Cert Manager troubleshooting doc](https://cert-manager.io/docs/troubleshooting/webhook/). 
- Last time, we had [this issue](https://cert-manager.io/docs/troubleshooting/webhook/#error-the-namespace-kube-system-is-managed-and-the-requests-verb-create-is-denied). We replaced every place having kube-system to cert-manager namespace. 
- [This issue](https://github.com/cert-manager/cert-manager/issues/466) remain unsolved. In the end, we switched to DNS01 challenge with Azure DNS

### DNS01 with Azure DNS
Make sure that you set the default subscription in **az account** command.

```bash
$ AZURE_CERT_MANAGER_NEW_SP_NAME=scaleway-cert-manager
# This is the name of the resource group that you have your dns zone in.
$ AZURE_DNS_ZONE_RESOURCE_GROUP=rg-dns
# The DNS zone name. It should be something like domain.com or sub.domain.com.
$ AZURE_DNS_ZONE=htoh.app

$ DNS_SP=$(az ad sp create-for-rbac --name $AZURE_CERT_MANAGER_NEW_SP_NAME --output json)
$ AZURE_CERT_MANAGER_SP_APP_ID=$(echo $DNS_SP | jq -r '.appId')
$ AZURE_CERT_MANAGER_SP_PASSWORD=$(echo $DNS_SP | jq -r '.password')
$ AZURE_TENANT_ID=$(echo $DNS_SP | jq -r '.tenant')
$ AZURE_SUBSCRIPTION_ID=$(az account show --output json | jq -r '.id')
```

Follows the other commands in [the guide](https://cert-manager.io/docs/configuration/acme/dns01/azuredns/#service-principal). 


Make sure to create and update secret reference from Scaleway in azuredns-client-secret.yaml. This scret should have the same value as **AZURE_CERT_MANAGER_SP_PASSWORD**.


## Deploy an application

Make sure to have a container registry credential to pull images from private registry.

### Prepare image pull secret
- Create a new API key in Scaleway with **ContainerRegistryReadOnly** access to Registry via Application + Policy. We can have the value by executing this command, then copy the value from K8s secret to Secret manager. Note that [there is some Scaleway specific regarding username](https://www.scaleway.com/en/docs/containers/kubernetes/how-to/deploy-image-from-container-registry/#how-to-create-an-image-pull-secret). Also, this secret has to be in the same namespace of the deploying application. It cannot work cluster wise.

```bash
# Create secret
kubectl create secret docker-registry registry-credential --docker-server=rg.fr-par.scw.cloud --docker-username=htoh --docker-password="$SCW_CONTAINER_KEY"
```

- Declare the ExternalSecret and putting a label into the application's namespace so that the ClusterSecretStore allows it to access secrrets.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: <application-namespace>
  labels:
    secret.htoh.io/required: "true"
```

- To use the credential, we need to [declare the secret along the Pod manifest](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/#create-a-pod-that-uses-your-secret). 


The container registry credential secret should be declare along side image name

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-reg
spec:
  containers:
  - name: private-reg-container
    image: <your-private-image>
  imagePullSecrets:
  - name: registry-credential
```