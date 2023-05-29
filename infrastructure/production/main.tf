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
      version = "2.20.0"
    }
  }
  required_version = ">= 0.13"
}

provider "scaleway" {
  zone   = var.zone
  region = var.region
}

resource "scaleway_iam_application" "github" {
  name        = "Github"
}

resource "scaleway_iam_application" "kubernetes" {
  name        = "Kubernetes"
}

resource "scaleway_iam_application" "htoh_api_dev" {
  name        = "HtoH API - dev"
}

resource "scaleway_iam_application" "htoh_api_prd" {
  name        = "HtoH API - prd"
}