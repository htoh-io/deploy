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

resource "scaleway_vpc_private_network" "dmz" {
  name = "dmz"
}

resource "scaleway_vpc_private_network" "app" {
  name = "app"
}

resource "scaleway_k8s_cluster" "cluster" {
  name                        = "exp-cluster"
  version                     = "1.27.1"
  cni                         = "cilium"
  delete_additional_resources = false
  private_network_id          = scaleway_vpc_private_network.app.id
}


resource "scaleway_k8s_pool" "pool_default" {
  cluster_id = scaleway_k8s_cluster.cluster.id
  name       = "default"
  node_type  = "PLAY2-MICRO"
  size       = 1

  depends_on = [scaleway_instance_security_group.kapsule]
}

resource "scaleway_rdb_instance" "db" {
  name           = "exp-db"
  node_type      = "DB-DEV-S"
  engine         = "PostgreSQL-14"
  is_ha_cluster  = false
  disable_backup = true
  user_name      = "manhha"
  password       = "veryS3cre7!"

  private_network {
    pn_id = scaleway_vpc_private_network.app.id
  }
}

resource "scaleway_rdb_acl" "main" {
  instance_id = scaleway_rdb_instance.db.id
  acl_rules {
    ip = "0.0.0.0/0"
    description = "default"
  }
}

resource "scaleway_instance_security_group" "kapsule" {
  name                    = "kubernetes ${split("/", scaleway_k8s_cluster.cluster.id)[1]}"
  inbound_default_policy  = "drop"
  outbound_default_policy = "accept"
  stateful                = true
  inbound_rule {
    action   = "accept"
    protocol = "UDP"
    port     = "500"
  }
  depends_on = [scaleway_k8s_cluster.cluster]
}