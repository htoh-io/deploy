## Deploy an environment from scratch

### Infrastructure

#### 1. Terraform

Create a new environment with Terraform. There should be couple of output
variables that you can use in the next step

Be aware that if you want to remove a test environment, make sure that bucket
is empty before deleting it.

#### 2. Pulumi

a. Creation

Stack creation should be run only once

```bash
export AZURE_STORAGE_ACCOUNT=htohinfra
export AZURE_KEYVAULT_AUTH_VIA_CLI=true

# Create a new stack
# Init stack
pulumi stack init <dev|stg|prd> --secrets-provider="azurekeyvault://htohinfra.vault.azure.net/keys/pulumi-encryption-key"

# Add secrets for ExternalSecretsComponent
cat ~/.kube/external-secrets/prd/.secret-key | pulumi config set --secret htoh:ssm-secret-key
cat ~/.kube/external-secrets/prd/.access-key | pulumi config set --secret htoh:ssm-access-key
```

Due to the fact that Pulumi doesn't wait for a Helm/Kustomize deployment finished
before running its dependencies, the following components will fail in the first
run:
- OpenTelemetryComponent
- HtohAppComponent

The work around is to disable them in the root index.ts in the first run.

```bash
pulumi stack select <env>
pulumi up
```

b. Run

If the Kubernetes config doesn't exist yet

```bash
scw account project list
scw k8s cluster list
# Copy the correct cluster ID
# then generate Kubeconfig
scw k8s kubeconfig get <k8s_cluster_id> > ~/.kube/clusters/kubeconfig-<env>.yaml
```

```bash
export KUBECONFIG=~/.kube/clusters/kubeconfig-<env>.yaml
export AZURE_STORAGE_ACCOUNT=htohinfra
export AZURE_KEYVAULT_AUTH_VIA_CLI=true
pulumi stack select <env>
pulumi up
```

### HtoH API
1. Make sure a database and user named htoh + permissions granted in Scaleway console
2. Use Adminer with port fortward (e.g. 8003) to add necessary extensions

```sql
CREATE EXTENSION postgis WITH SCHEMA public;
CREATE EXTENSION postgis_sfcgal WITH SCHEMA public;
CREATE EXTENSION postgis_topology;
CREATE EXTENSION postgis_raster;
CREATE EXTENSION postgis_tiger_geocoder CASCADE;
```

3. Add [Github environment parameters](https://github.com/htoh-io/htoh-api/settings/environments) corresponding to the environment you created
4. Create in your Scaleway a secret named 
4. Update the overlay's configmap of the environment in the htoh-api repository
5. Trigger a Github build to deploy

## Clean up
1. Remove resources in Pulumi.
    - Sometimes, LoadBalancer is not removed. You need to make sure it is no longer there
2. Remove resources in Terraform
    - If a bucket is not empty, we might not able to remove it.


## Troubleshooting

### The htoh-api cannot resolve its own OIDC configuration
Check the full stack trace log, it is probably related to the fact that it
cannot requet its own openid-connection endpoint due to the **SSL connection error**
below.

### SSL connection error:
1. Check the ingress-controller log
2. If there is issue with PROXY protocol, make sure that the ingress controller
has [the params recommended by Scaleway](https://www.scaleway.com/en/docs/tutorials/proxy-protocol-v2-load-balancer/#configuring-proxy-protocol-for-ingress-nginx).

### Check container registry access

```bash
docker login rg.fr-par.scw.cloud/htoh -u nologin --password-stdin <<< "$SCW_SECRET_KEY" 
```