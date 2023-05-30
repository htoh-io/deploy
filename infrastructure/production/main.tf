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
      version = "2.20.0"
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

resource "scaleway_iam_application" "github" {
  name = "Github"
}

resource "scaleway_iam_application" "kubernetes" {
  name        = "Kubernetes"
  description = "Access to container registry"
}

resource "scaleway_iam_application" "htoh_api_dev" {
  name = "HtoH API - dev"
}

resource "scaleway_iam_application" "htoh_api_prd" {
  name = "HtoH API - prd"
}

resource "scaleway_iam_policy" "github" {
  application_id = scaleway_iam_application.github.id
  name           = "Github"

  rule {
    permission_set_names = [
      "ContainerRegistryFullAccess",
    ]
    project_ids = [
      data.scaleway_account_project.default.id,
      data.scaleway_account_project.production.id,
    ]
  }
  rule {
    permission_set_names = [
      "FunctionsFullAccess",
    ]
    project_ids = [
      data.scaleway_account_project.production.id,
    ]
  }
}

resource "scaleway_iam_policy" "htoh_api_dev" {
  application_id = scaleway_iam_application.htoh_api_dev.id
  name           = "HtoH API - dev"

  rule {
    permission_set_names = [
      "ObjectStorageFullAccess",
    ]
    project_ids = [
      data.scaleway_account_project.development.id,
    ]
  }
}

resource "scaleway_iam_policy" "htoh_api_prd" {
  application_id = scaleway_iam_application.htoh_api_prd.id
  name           = "HtoH API - prd"

  rule {
    permission_set_names = [
      "ObjectStorageFullAccess",
      "ObjectStorageObjectsDelete",
      "ObjectStorageObjectsRead",
      "ObjectStorageObjectsWrite",
      "ObjectStorageReadOnly",
    ]
    project_ids = [
      data.scaleway_account_project.production.id,
    ]
  }
}

resource "scaleway_iam_policy" "kubernetes" {
  application_id = scaleway_iam_application.kubernetes.id
  name           = "Kubernetes"
  description    = "Access to container registry"

  rule {
    permission_set_names = [
      "ContainerRegistryReadOnly",
      "SecretManagerFullAccess",
    ]
    project_ids = [
      data.scaleway_account_project.default.id,
      data.scaleway_account_project.production.id,
    ]
  }
}