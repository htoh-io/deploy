terraform {
  backend "azurerm" {
    resource_group_name  = "rg-ops"
    storage_account_name = "htohinfra"
    container_name       = "terraform-stg"
    key                  = "terraform.tfstate"
    subscription_id      = "a130654f-11e9-4af9-a215-a62b7dfcfc22"
    tenant_id            = "16843612-824f-477b-a87b-20f98cf04416"
  }
}

terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "2.29.0"
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
  vpc_id      = scaleway_vpc.vpc_par.id
  project_id  = var.project_id
  tags        = ["terraform"]
}