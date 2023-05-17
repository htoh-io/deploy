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

resource "scaleway_vpc_private_network" "pn01" {
  name = "dmz"
}

resource "scaleway_vpc_gateway_network" "dmz" {
  gateway_id         = scaleway_vpc_public_gateway.pg01.id
  private_network_id = scaleway_vpc_private_network.pn01.id
  dhcp_id            = scaleway_vpc_public_gateway_dhcp.dhcp01.id
  cleanup_dhcp       = true
  enable_masquerade  = true
}

resource "scaleway_rdb_instance" "db" {
  name           = "test-db"
  node_type      = "DB-DEV-S"
  engine         = "PostgreSQL-14"
  is_ha_cluster  = false
  disable_backup = true
  user_name      = "manhha"
  password       = "veryS3cre7!"

  private_network {
    pn_id = scaleway_vpc_private_network.pn01.id
  }
}

resource "scaleway_instance_server" "app" {
  project_id = var.project_id
  type       = "DEV1-S"
  image      = "ubuntu_jammy"
  name       = "app"

  tags = ["app", "managed-by:terraform"]

  security_group_id = scaleway_instance_security_group.www.id
}

resource "scaleway_instance_private_nic" "app_dmz" {
  server_id          = scaleway_instance_server.app.id
  private_network_id = scaleway_vpc_private_network.pn01.id
}

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

resource "scaleway_lb_ip" "main" {
  zone = "fr-par-1"
}

resource "scaleway_lb" "base" {
  ip_id  = scaleway_lb_ip.main.id
  zone   = scaleway_lb_ip.main.zone
  type   = "LB-S"

  private_network {
    private_network_id = scaleway_vpc_private_network.pn01.id
    dhcp_config = true
  }

  depends_on = [scaleway_vpc_public_gateway.pg01]
}

resource "scaleway_lb_backend" "backend01" {
  lb_id            = scaleway_lb.base.id
  name             = "backend01"
  forward_protocol = "http"
  forward_port     = "80"

  server_ips = [
    "192.168.1.224"
  ]

  health_check_http {
    uri = "/_/health"
  }
}

resource "scaleway_lb_frontend" "frontend01" {
  lb_id        = scaleway_lb.base.id
  backend_id   = scaleway_lb_backend.backend01.id
  name         = "frontend01"
  inbound_port = "80"
}