# Deploy Grafna Agent Operator

## Run the Kustomize deployment

```bash
kubectl apply -k ./
```

## Install CRDs and deploy Agent Operator 

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm install grafana-agent-operator --create-namespace grafana/grafana-agent-operator -n grafana
```