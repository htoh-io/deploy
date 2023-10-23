terraform {
  backend "azurerm" {
    resource_group_name  = "rg-ops"
    storage_account_name = "htohinfra"
    container_name       = "terraform-prd"
    key                  = "terraform.tfstate"
    subscription_id      = "a130654f-11e9-4af9-a215-a62b7dfcfc22"
    tenant_id            = "16843612-824f-477b-a87b-20f98cf04416"
  }
}

terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "2.30.0"
    }
  }
  required_version = ">= 0.13"
}

provider "scaleway" {
  zone   = var.zone
  region = var.region
}

data "scaleway_account_project" "production" {
  name = "production"
}

resource "scaleway_vpc" "vpc_par" {
  name       = "vpc-par"
  region     = "fr-par"
  project_id = data.scaleway_account_project.production.id
  tags       = ["terraform"]
}

resource "scaleway_vpc_private_network" "apps" {
  name        = "apps"
  vpc_id      = scaleway_vpc.vpc_par.id
  project_id  = data.scaleway_account_project.production.id
  tags        = ["terraform"]
}

resource "scaleway_k8s_cluster" "apps" {
  name                        = "apps"
  version                     = "1.28"
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

resource "scaleway_k8s_pool" "apps_default" {
  cluster_id  = scaleway_k8s_cluster.apps.id
  name        = "default"
  node_type   = "PLAY2_MICRO"
  size        = 1
  min_size    = 1
  max_size    = 10
  autoscaling = false
}

resource "scaleway_rdb_instance" "main" {
  name           = "main"
  node_type      = "DB-DEV-M"
  engine         = "PostgreSQL-15"
  is_ha_cluster  = false
  disable_backup = false
  project_id     = var.project_id
  volume_size_in_gb = 25
  volume_type = "bssd"

  private_network {
    pn_id = scaleway_vpc_private_network.apps.id
  }
}

# resource "scaleway_rdb_database" "htoh" {
#   instance_id    = scaleway_rdb_instance.main.id
#   name           = "htoh"
# }

resource "scaleway_rdb_acl" "private_network" {
  instance_id = scaleway_rdb_instance.main.id
  acl_rules {
    ip = scaleway_vpc_private_network.apps.ipv4_subnet[0].subnet
    description = "Private network"
  }
}

output "database_address_host" {
  value = "jdbc:postgresql://${scaleway_rdb_instance.main.private_network[0].ip}:${scaleway_rdb_instance.main.private_network[0].port}/htoh?ssl=true&sslmode=require"
}

output "k8s_cluster_id" {
  value = scaleway_k8s_cluster.apps.id
}

output "k8s_cluster_url" {
  value = scaleway_k8s_cluster.apps.apiserver_url
}