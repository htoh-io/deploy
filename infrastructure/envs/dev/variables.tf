variable "zone" {
  type        = string
  description = "Zone (ex: fr-par-1)"
}

variable "region" {
  type        = string
  description = "Region (ex: fr-par)"
}

variable "project_id" {
  type        = string
  description = "Project ID"
}

variable "environment" {
  type        = string
  description = "Environment's name, e.g. prd, stg, ..."
}