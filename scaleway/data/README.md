
## Installation of Superset

- Make sure secrets are created

```bash
kubectl apply -k ./
```

- Install Helmchart

```bash
helm install apache-superset superset/superset -n data --values superset-values.yaml
```

## Upgrade or uninstall Helmchart

In case there is an update in the config, we can upgrade the chart

```bash
helm upgrade apache-superset superset/superset -n data --values superset-values.yaml
```

Or if we want to uninstall it

```bash
helm uninstall apache-superset -n data
```