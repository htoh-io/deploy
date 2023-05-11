terraform {
  backend "s3" {
    bucket                      = "htoh-terraform"
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
      source = "scaleway/scaleway"
    }
  }
  required_version = ">= 0.13"
}

provider "scaleway" {
  zone   = var.zone
  region = var.region
}

resource "scaleway_vpc_private_network" "pn01" {
  name = "dmz"
}

resource "scaleway_k8s_cluster" "kapsule" {
  name    = "kapsule"
  version = "1.27.1"
  cni     = "cilium"
  delete_additional_resources = false
  private_network_id = scaleway_vpc_private_network.pn01.id 
}

resource "scaleway_k8s_pool" "kapsule_default" {
  cluster_id = scaleway_k8s_cluster.kapsule.id
  name       = "default"
  node_type  = "PLAY2-MICRO"
  size       = 1
}

resource "scaleway_rdb_instance" "test_vpc" {
  name           = "test-rdb"
  node_type      = "DB-DEV-S"
  engine         = "PostgreSQL-11"
  is_ha_cluster  = false
  disable_backup = true
  user_name      = "my_initial_user"
  password       = "thiZ_is_v&ry_s3cret"

  private_network {
    pn_id = scaleway_vpc_private_network.pn01.id
  }
}
