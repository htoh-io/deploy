#!/bin/zsh

# Warning: This script could fail if there 
# is more than one cluster per environment

declare -A envs
envs[dev]=development
envs[stg]=staging
envs[prd]=production

env=$1
env_name=$envs[$env]

project_id=$(scw account project list -o json | jq -r ".[] | select(.name | contains(\"$env_name\")) | .id")
cluster_id=$(scw k8s cluster list -o json | jq -r ".[] | select(.project_id | contains(\"$project_id\")) | .id")
echo "Copying config for cluster_id = $cluster_id in project_id = $project_id"
scw k8s kubeconfig get $cluster_id > ~/.kube/clusters/kubeconfig-$env.yaml

export AZURE_STORAGE_ACCOUNT=htohinfra
export AZURE_KEYVAULT_AUTH_VIA_CLI=true