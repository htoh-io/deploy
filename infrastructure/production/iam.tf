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

resource "scaleway_iam_api_key" "kubernetes1" {
  application_id = scaleway_iam_application.kubernetes.id
  description    = "Access to container registry, read secrets"
}

resource "scaleway_iam_api_key" "htoh_api_dev1" {
  application_id = scaleway_iam_application.htoh_api_dev.id
  description    = "Run tests during development phase"
}

resource "scaleway_iam_api_key" "htoh_api_prd1" {
  application_id = scaleway_iam_application.htoh_api_prd.id
}

resource "scaleway_iam_api_key" "github1" {
  application_id = scaleway_iam_application.github.id
  description    = "Github Actions"
}