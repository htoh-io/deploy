terraform {
  backend "s3" {
    bucket                      = "stg-terraform"
    key                         = "terraform_state.tfstate"
    region                      = "fr-par"
    endpoint                    = "https://s3.fr-par.scw.cloud"
    skip_credentials_validation = true
    skip_region_validation      = true
  }
}

terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "2.21.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.10.1"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.21.1"
    }
  }
  required_version = ">= 0.13"
}

provider "scaleway" {
  zone   = var.zone
  region = var.region
}

data "scaleway_account_project" "default" {
  name = "default"
}

data "scaleway_account_project" "staging" {
  name = "staging"
}

resource "scaleway_vpc" "vpc_par" {
  name       = "default"
  region     = var.region
  project_id = var.project_id
  tags       = ["terraform"]
}

resource "scaleway_vpc_private_network" "apps" {
  name        = "apps"
  is_regional = true
  vpc_id      = scaleway_vpc.vpc_par.id
  project_id  = var.project_id
  tags        = ["terraform"]
}

data "scaleway_secret" "htoh_db_admin_password" {
  secret_id  = "29a1eb83-c298-4ce9-930f-295151db3301"
  project_id = var.project_id
}

data "scaleway_secret_version" "htoh_db_admin_password" {
  secret_id = data.scaleway_secret.htoh_db_admin_password.secret_id
  revision  = "1"
}

data "scaleway_secret" "htoh_db_htoh_password" {
  secret_id  = "988755b5-81ad-4adf-af4c-ac4e35ea6d4d"
  project_id = var.project_id
}

data "scaleway_secret_version" "htoh_db_htoh_password" {
  secret_id = data.scaleway_secret.htoh_db_htoh_password.secret_id
  revision  = "1"
}

resource "scaleway_rdb_instance" "htoh" {
  name           = "htoh-stg"
  node_type      = "DB-DEV-S"
  engine         = "PostgreSQL-14"
  is_ha_cluster  = false
  disable_backup = true
  user_name      = "admin"
  password       = base64decode(data.scaleway_secret_version.htoh_db_admin_password.data)
  project_id     = var.project_id

  private_network {
    pn_id = scaleway_vpc_private_network.apps.id
  }
}

resource "scaleway_rdb_database" "htoh" {
  instance_id = scaleway_rdb_instance.htoh.id
  name        = "htoh"
}

resource "scaleway_rdb_user" "htoh" {
  instance_id = scaleway_rdb_instance.htoh.id
  name        = "htoh"
  password    = base64decode(data.scaleway_secret_version.htoh_db_htoh_password.data)
  is_admin    = true
}

resource "scaleway_rdb_privilege" "main" {
  instance_id   = scaleway_rdb_instance.htoh.id
  user_name     = "htoh"
  database_name = "htoh"
  permission    = "all"

  depends_on = [scaleway_rdb_user.htoh, scaleway_rdb_database.htoh]
}

resource "scaleway_rdb_acl" "private_network" {
  instance_id = scaleway_rdb_instance.htoh.id
  acl_rules {
    ip          = "172.16.4.0/22"
    description = "Private network with K8s"
  }
}

resource "scaleway_k8s_cluster" "htoh" {
  name                        = "htoh-stg"
  version                     = "1.27"
  cni                         = "cilium"
  delete_additional_resources = false
  project_id                  = var.project_id

  private_network_id = scaleway_vpc_private_network.apps.id

  auto_upgrade {
    enable                        = true
    maintenance_window_start_hour = 1
    maintenance_window_day        = "saturday"
  }
}

resource "scaleway_k8s_pool" "htoh_default" {
  cluster_id  = scaleway_k8s_cluster.htoh.id
  name        = "default"
  node_type   = "PLAY2_MICRO"
  size        = 1
  min_size    = 1
  max_size    = 10
  autoscaling = false
}

resource "null_resource" "kubeconfig" {
  depends_on = [scaleway_k8s_pool.htoh_default] # at least one pool here
  triggers = {
    host                   = scaleway_k8s_cluster.htoh.kubeconfig[0].host
    token                  = scaleway_k8s_cluster.htoh.kubeconfig[0].token
    cluster_ca_certificate = scaleway_k8s_cluster.htoh.kubeconfig[0].cluster_ca_certificate
  }
}

provider "helm" {
  kubernetes {
    host                   = null_resource.kubeconfig.triggers.host
    token                  = null_resource.kubeconfig.triggers.token
    cluster_ca_certificate = base64decode(null_resource.kubeconfig.triggers.cluster_ca_certificate)
  }
}

// external-secrets

resource "helm_release" "external_secrets" {
  name             = "external-secrets"
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  version          = "v0.8.2"
  namespace        = "external-secrets"
  create_namespace = true
}

provider "kubernetes" {
  host                   = scaleway_k8s_cluster.htoh.kubeconfig[0].host
  cluster_ca_certificate = base64decode(null_resource.kubeconfig.triggers.cluster_ca_certificate)
  token                  = scaleway_k8s_cluster.htoh.kubeconfig[0].token
}

resource "scaleway_iam_application" "kubernetes" {
  name = "Kubernetes - stg"
}

resource "scaleway_iam_policy" "kubernetes" {
  application_id = scaleway_iam_application.kubernetes.id
  name           = "Kubernetes - stg"
  description    = "Access to container registry and secrets"

  rule {
    permission_set_names = [
      "ContainerRegistryReadOnly",
      "SecretManagerFullAccess",
    ]
    project_ids = [
      data.scaleway_account_project.default.id,
      data.scaleway_account_project.staging.id,
    ]
  }
}

resource "scaleway_iam_api_key" "kubernetes1" {
  application_id = scaleway_iam_application.kubernetes.id
  description    = "Access to container registry and secrets on staging"
}

resource "kubernetes_secret" "scwsm_secret" {
  metadata {
    name      = "scwsm-secret"
    namespace = "external-secrets"
  }

  data = {
    access-key = scaleway_iam_api_key.kubernetes1.access_key
    secret-key = scaleway_iam_api_key.kubernetes1.secret_key
  }

  depends_on = [helm_release.external_secrets]
}


resource "kubernetes_manifest" "scw_secret_store" {
  manifest = {
    apiVersion = "external-secrets.io/v1beta1"
    kind       = "ClusterSecretStore"
    metadata = {
      name = "scw-secret-store"
    }
    spec = {
      conditions = [
        {
          namespaceSelector = {
            matchLabels = {
              "secret.htoh.io/required" = "true"
            }
          }
        },
        {
          namespaces = ["cert-manager"]
        },
      ]
      provider = {
        scaleway = {
          projectId = var.project_id
          region    = var.region
          accessKey = {
            secretRef = {
              key       = "access-key"
              name      = "scwsm-secret"
              namespace = "external-secrets"
            }
          }

          secretKey = {
            secretRef = {
              key       = "secret-key"
              name      = "scwsm-secret"
              namespace = "external-secrets"
            }
          }
        }
      }
    }
  }
}

// htoh

resource "kubernetes_namespace" "htoh" {
  metadata {
    name = "htoh"

    labels = {
      "secret.htoh.io/required" = true
    }
  }
}

resource "kubernetes_secret" "registry_credential" {
  metadata {
    name      = "registry-credential"
    namespace = kubernetes_namespace.htoh.metadata[0].name
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "rg.fr-par.scw.cloud" = {
          "username" = "htoh"
          "password" = scaleway_iam_api_key.kubernetes1.secret_key
          "auth"     = base64encode("htoh:${scaleway_iam_api_key.kubernetes1.secret_key}")
        }
      }
    })
  }
}

// cert-manager

resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  version          = "v1.12.1"
  namespace        = "cert-manager"
  create_namespace = true

  set {
    name  = "installCRDs"
    value = "true"
  }
}

resource "kubernetes_manifest" "external_secret_azuredns_config" {
  manifest = {
    apiVersion = "external-secrets.io/v1beta1"
    kind       = "ExternalSecret"
    metadata = {
      name      = "azuredns-config"
      namespace = "cert-manager"
    }
    spec = {
      refreshInterval = "60m"
      secretStoreRef = {
        name = "scw-secret-store"
        kind = "ClusterSecretStore"
      }
      target = {
        name = "azuredns-config"
      }
      data = [{
        secretKey = "client-secret"
        remoteRef = {
          key     = "id:bdddd9df-81a2-4fbd-9f27-450a8d23d0ff"
          version = "latest_enabled"
        }
      }]
    }
  }
}

resource "kubernetes_manifest" "cert_manager_cluster_issuer" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name = "letsencrypt"
    }
    spec = {
      acme = {
        email          = "manhha@htoh.io"
        preferredChain = ""
        privateKeySecretRef = {
          name = "letsencrypt"
        }
        server = "https://acme-v02.api.letsencrypt.org/directory"
        solvers = [{
          dns01 = {
            azureDNS = {
              clientID = "c8d5b098-5728-4eaa-98e3-28a47bfdea9e"
              clientSecretSecretRef = {
                name = "azuredns-config"
                key  = "client-secret"
              }
              subscriptionID    = "a130654f-11e9-4af9-a215-a62b7dfcfc22"
              tenantID          = "16843612-824f-477b-a87b-20f98cf04416"
              resourceGroupName = "rg-dns"
              hostedZoneName    = "htoh.app"
              environment       = "AzurePublicCloud"
            }
          }
        }]
      }
    }
  }
}

// ingress-controller

resource "scaleway_lb_ip" "ingress_ip" {
  zone       = var.zone
  project_id = var.project_id
}

resource "helm_release" "nginx_ingress" {
  name      = "nginx-ingress"
  namespace = "kube-system"

  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"

  set {
    name  = "controller.service.loadBalancerIP"
    value = scaleway_lb_ip.ingress_ip.ip_address
  }

  // enable proxy protocol to get client ip addr instead of loadbalancer one
  set {
    name  = "controller.config.use-proxy-protocol"
    value = "true"
  }
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/scw-loadbalancer-proxy-protocol-v2"
    value = "true"
  }

  // indicates in which zone to create the loadbalancer
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/scw-loadbalancer-zone"
    value = scaleway_lb_ip.ingress_ip.zone
  }

  // enable to avoid node forwarding
  set {
    name  = "controller.service.externalTrafficPolicy"
    value = "Local"
  }

  // enable this annotation to use cert-manager
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/scw-loadbalancer-use-hostname"
    value = "true"
  }
}