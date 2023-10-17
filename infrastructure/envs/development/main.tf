terraform {
  backend "azurerm" {
    resource_group_name  = "rg-ops"
    storage_account_name = "htohinfra"
    container_name       = "terraform-dev"
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

data "scaleway_account_project" "development" {
  name = "development"
}

resource "scaleway_vpc" "vpc_par" {
  name       = "default"
  region     = var.region
  project_id = var.project_id
  tags       = ["terraform"]
}

resource "scaleway_vpc_private_network" "apps" {
  name        = "apps"
  vpc_id      = scaleway_vpc.vpc_par.id
  project_id  = var.project_id
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

  # openid_connect_config {
  #   issuer_url = "https://login.microsoftonline.com/16843612-824f-477b-a87b-20f98cf04416/v2.0"
  #   client_id = "dc5fe4b2-4454-4ccb-93a4-4d5edd12ab28"
  #   username_claim = "upn"
  # }
}

resource "scaleway_k8s_pool" "apps_pool" {
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
  node_type      = "DB-DEV-S"
  engine         = "PostgreSQL-15"
  is_ha_cluster  = false
  disable_backup = true
  user_name      = "admin"
  password       = "!HtoHSecret3"
  project_id     = var.project_id

  private_network {
    pn_id = scaleway_vpc_private_network.apps.id
  }
}

resource "scaleway_rdb_acl" "private_network" {
  instance_id = scaleway_rdb_instance.main.id
  acl_rules {
    ip = scaleway_vpc_private_network.apps.ipv4_subnet[0].subnet
    description = "Private network"
  }
}