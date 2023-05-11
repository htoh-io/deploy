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

resource "scaleway_vpc_public_gateway_ip" "gw01" {
}

resource "scaleway_vpc_public_gateway_dhcp" "dhcp01" {
  subnet             = "192.168.1.0/24"
  push_default_route = true
}

resource "scaleway_vpc_public_gateway" "pg01" {
  name            = "public-gateway"
  type            = "VPC-GW-S"
  ip_id           = scaleway_vpc_public_gateway_ip.gw01.id
  bastion_enabled = true
}

resource "scaleway_vpc_gateway_network" "main" {
  gateway_id         = scaleway_vpc_public_gateway.pg01.id
  private_network_id = scaleway_vpc_private_network.pn01.id
  dhcp_id            = scaleway_vpc_public_gateway_dhcp.dhcp01.id
  cleanup_dhcp       = true
  enable_masquerade  = true
}

resource "scaleway_instance_server" "kosmos_instance" {
  count      = 2
  project_id = var.project_id
  type       = "PLAY2-MICRO"
  image      = "ubuntu_jammy"
  name       = "${scaleway_k8s_cluster.kosmos.name}-${scaleway_k8s_pool.kosmos_external.name}-${count.index}"

  tags = ["kosmos", "managed-by:terraform"]

  user_data = {
    cloud-init = <<-EOF
    #cloud-config

    package_update: true

    runcmd:
      - wget https://scwcontainermulticloud.s3.fr-par.scw.cloud/multicloud-init.sh
      - chmod +x multicloud-init.sh
      - ./multicloud-init.sh -p 3758cdeb-ec2a-4809-96b6-70490922539f -r fr-par -t bab05934-61af-4281-be69-c57d1d15e7e2
    EOF
  }
}

resource "scaleway_instance_private_nic" "kosmos_instance_1_dmz" {
  count              = length(scaleway_instance_server.kosmos_instance)
  server_id          = scaleway_instance_server.kosmos_instance[count.index].id
  private_network_id = scaleway_vpc_private_network.pn01.id
}

resource "scaleway_rdb_instance" "test_vpc" {
  name           = "test-rdb"
  node_type      = "DB-DEV-S"
  engine         = "PostgreSQL-11"
  is_ha_cluster  = true
  disable_backup = true
  user_name      = "my_initial_user"
  password       = "thiZ_is_v&ry_s3cret"
}

resource "scaleway_k8s_cluster" "kosmos" {
  name                        = "kosmos"
  type                        = "multicloud"
  version                     = "1.26.4"
  cni                         = "kilo"
  delete_additional_resources = false
}

resource "scaleway_k8s_pool" "kosmos_external" {
  cluster_id = scaleway_k8s_cluster.kosmos.id
  name       = "external"
  node_type  = "external"
  size       = 0
  min_size   = 0
}