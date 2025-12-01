output "website_url" {
  value = "https://${var.site_subdomain}.${var.site_domain}"
}

output "s3_bucket_name" {
  value = aws_s3_bucket.site_bucket.bucket
}   