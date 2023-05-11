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


# resource "scaleway_instance_ip" "public_ip" {
#   project_id = var.project_id
# }

# resource "scaleway_instance_volume" "data" {
#   project_id = var.project_id
#   size_in_gb = 10
#   type       = "b_ssd"
# }

resource "scaleway_instance_security_group" "www" {
  project_id              = var.project_id
  inbound_default_policy  = "drop"
  outbound_default_policy = "accept"

  inbound_rule {
    action   = "accept"
    port     = "22"
    ip_range = "0.0.0.0/0"
  }

  inbound_rule {
    action = "accept"
    port   = "80"
  }

  inbound_rule {
    action = "accept"
    port   = "443"
  }
}

resource "scaleway_instance_server" "web" {
  project_id = var.project_id
  type       = "DEV1-S"
  image      = "ubuntu_jammy"
  name       = "web"

  tags = ["front", "web", "managed-by:terraform"]

  # ip_id = scaleway_instance_ip.public_ip.id

  # additional_volume_ids = [scaleway_instance_volume.data.id]

  #   root_volume {
  #     # The local storage of a DEV1-L instance is 80 GB, subtract 30 GB from the additional l_ssd volume, then the root volume needs to be 50 GB.
  #     # size_in_gb = 10
  #     delete_on_termination = true
  #   }

  security_group_id = scaleway_instance_security_group.www.id
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

resource "scaleway_instance_private_nic" "web_dmz" {
  server_id          = scaleway_instance_server.web.id
  private_network_id = scaleway_vpc_private_network.pn01.id
}

data "scaleway_vpc_public_gateway_dhcp_reservation" "by_mac_address" {
  mac_address = "${scaleway_instance_private_nic.web_dmz.mac_address}"
}