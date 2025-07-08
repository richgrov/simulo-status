variable "project_id" {
  type        = string
  description = "Google Cloud Project ID"
}

variable "region" {
  type        = string
  description = "Google Cloud Region"
}

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "6.8.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "6.8.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

resource "google_storage_bucket" "source" {
  name                        = "${var.project_id}-functions-source"
  location                    = var.region
  uniform_bucket_level_access = true
}

data "archive_file" "public_info" {
  type        = "zip"
  output_path = ".terraform/public_info.zip"
  source_dir  = "functions/public_info"
}

resource "google_storage_bucket_object" "source_object" {
  name   = "function-source.zip"
  bucket = google_storage_bucket.source.name
  source = data.archive_file.public_info.output_path
}

resource "google_cloudfunctions2_function" "default" {
  name        = "public-info"
  location    = var.region
  description = "Public status information"
  build_config {
    runtime     = "python310"
    entry_point = "main"
    source {
      storage_source {
        bucket = google_storage_bucket.source.name
        object = google_storage_bucket_object.source_object.name
      }
    }
  }

  service_config {
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 5
  }
}

resource "google_api_gateway_api" "status_api" {
  provider = google-beta
  api_id   = "status-api"
}

resource "google_api_gateway_api_config" "status_api_config" {
  provider      = google-beta
  api           = google_api_gateway_api.status_api.api_id
  api_config_id = "status-api-config"
  openapi_documents {
    document {
      path     = "spec.yaml"
      contents = filebase64("functions/spec.yaml")
    }
  }
}

resource "google_api_gateway_gateway" "gateway" {
  provider   = google-beta
  api_config = google_api_gateway_api_config.status_api_config.id
  gateway_id = "status-gateway"
}
