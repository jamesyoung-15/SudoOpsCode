provider "aws" {
  region = var.aws_region
  profile = var.aws_profile
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}