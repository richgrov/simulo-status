variable "project_id" {
  type        = string
  description = "Google Cloud Project ID"
}

variable "region" {
  type        = string
  description = "Google Cloud Region"
}

variable "cors_origin" {
  type        = string
  description = "CORS_ORIGIN environment variable for public-info function"
}

resource "google_secret_manager_secret" "cors_origin" {
  secret_id = "cors_origin"
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

resource "google_secret_manager_secret_version" "cors_origin_version" {
  secret      = google_secret_manager_secret.cors_origin.id
  secret_data = var.cors_origin
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
  source_dir  = "functions"
  excludes    = [".venv/", ".ropeproject/", "__pycache__/", ".env"]
}

resource "google_storage_bucket_object" "source_object" {
  name   = "${data.archive_file.public_info.output_sha256}.zip"
  bucket = google_storage_bucket.source.name
  source = data.archive_file.public_info.output_path
}

resource "google_cloudfunctions2_function" "default" {
  name        = "public-info"
  location    = var.region
  description = "Public status information"
  build_config {
    runtime     = "python310"
    entry_point = "public_info"
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
    secret_environment_variables {
      project_id = var.project_id
      key        = "CORS_ORIGIN"
      secret     = google_secret_manager_secret.cors_origin.secret_id
      version    = "latest"
    }
    service_account_email = google_service_account.functions_account.email
  }
}

resource "google_cloudfunctions2_function" "log" {
  name        = "log"
  location    = var.region
  description = "Log backend infrastructre state"
  build_config {
    runtime     = "python310"
    entry_point = "log"
    source {
      storage_source {
        bucket = google_storage_bucket.source.name
        object = google_storage_bucket_object.source_object.name
      }
    }
  }

  service_config {
    max_instance_count    = 1
    available_memory      = "256M"
    timeout_seconds       = 5
    service_account_email = google_service_account.functions_account.email
  }
}

resource "google_api_gateway_api" "status_api" {
  provider = google-beta
  api_id   = "status-api"
}

resource "google_api_gateway_api_config" "status_api_config" {
  provider      = google-beta
  api           = google_api_gateway_api.status_api.api_id
  api_config_id = "gateway-config-${filesha1("functions/spec.yaml")}"
  openapi_documents {
    document {
      path     = "spec.yaml"
      contents = filebase64("functions/spec.yaml")
    }
  }
  lifecycle {
    create_before_destroy = true
  }
  gateway_config {
    backend_config {
      google_service_account = google_service_account.gateway_account.email
    }
  }
}

resource "google_api_gateway_gateway" "gateway" {
  provider   = google-beta
  api_config = google_api_gateway_api_config.status_api_config.id
  gateway_id = "status-gateway"
}

resource "google_firestore_database" "database" {
  name        = "status-db"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
}

resource "google_service_account" "functions_account" {
  account_id   = "functions-account"
  display_name = "Cloud Functions Service Account"
}

resource "google_project_iam_member" "functions_account_firestore_member" {
  project = var.project_id
  role    = "roles/datastore.owner"
  member  = "serviceAccount:${google_service_account.functions_account.email}"
}

resource "google_project_iam_member" "functions_account_secret_manager_member" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.functions_account.email}"
}

resource "google_service_account_key" "functions_account_key" {
  service_account_id = google_service_account.functions_account.name
}

resource "google_service_account" "gateway_account" {
  account_id   = "gateway-account"
  display_name = "Gateway Service Account"
}

resource "google_project_iam_member" "gateway_account_cloud_run_member" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.gateway_account.email}"
}

resource "google_cloudfunctions2_function_iam_member" "invoker" {
  project        = var.project_id
  location       = var.region
  cloud_function = google_cloudfunctions2_function.default.name
  role           = "roles/cloudfunctions.invoker"
  member         = "serviceAccount:${google_service_account.gateway_account.email}"
}

