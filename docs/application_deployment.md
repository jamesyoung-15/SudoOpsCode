# Deploying Application

Below shows how I deployed my application. For frontend I used public S3 to host static frontend files and Cloudflare as my DNS provider and CDN. For backend I use a free Oracle Linux instance with a public IP to deploy my backend express API and SQLite database in one place.

## Frontend Terraform

I use S3 + Cloudflare for my frontend. I use Terraform to create the resources, then upload the frontend files to S3.

First setup Terraform variables by creating a `terraform.tfvars` inside `terraform` directory. Make sure to pass the Cloudflare token, and override any variables like the domain/subdomain variables, eg:

``` txt
aws_profile          = "Prod"
cloudflare_api_token = "your_token"
```

Then run below commands

``` bash
cd terraform
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
# destroy
terraform destroy -var-file=terraform.tfvars
```

Next, build the frontend, sync it to the S3 bucket.

``` bash
cd frontend
npm run build
aws s3 cp dist/ s3://<BUCKET_NAME>/ --recursive --profile default
```

## Backend Setup

Use any Linux VPS. I used Oracle ARM Instance as it's free. Choose whichever distro.

Very important you check the networking setting of the instance. For example, for many Oracle instances they have `iptables` configured that will block incoming requests, so you need to modify it, eg:

``` bash
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

```

Install Docker, Nginx, git. Make sure you can `curl http://instance_public_pi` from outside to double check network settings.

Then, clone repo and setup backend normally:

``` bash
git clone https://github.com/jamesyoung-15/SudoOpsCode
cd SudoOpsCode
docker build -f backend/challenges/Dockerfile.challenge -t challenge-runner:v1.0 .
cd backend
npm run build
npm run start
```

To access the API via port 80, we can use Nginx. Setup a nginx config with something like:

``` bash
cd backend
sudo cp nginx/nginx.conf /etc/nginx/sites-available/yourdomain
sudo ln -s /etc/nginx/sites-available/yourdomain /etc/nginx/sites-enabled/ 
sudo nginx -t
sudo systemctl restart nginx
```
