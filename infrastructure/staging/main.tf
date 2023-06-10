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
    name = "registry-credential"
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