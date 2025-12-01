terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 5.4"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.4"
    }
  }
}