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
      source  = "scaleway/scaleway"
      version = "2.21.0"
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

data "scaleway_account_project" "production" {
  name = "production"
}


data "scaleway_account_project" "development" {
  name = "development"
}

resource "scaleway_vpc" "vpc01" {
    name = "default"
    region = "fr-par"
    project_id = data.scaleway_account_project.production.id
}

resource "scaleway_vpc_private_network" "apps" {
  name        = "apps"
  is_regional = true
  vpc_id      = scaleway_vpc.vpc01.id
  tags = ["managed_by:terraform"]
}