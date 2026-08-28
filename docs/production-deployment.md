# Production deployment

The production pipeline is intentionally gated:

```text
Push to main -> CI validation -> changed images -> ECR -> EC2 pull/restart -> health checks
```

## GitHub configuration

Create these repository variables:

- `AWS_REGION` — AWS region containing the ECR repositories (defaults to `ca-central-1`)
- `AWS_ACCOUNT_ID` — AWS account ID

Create this repository secret:

- `AWS_DEPLOY_ROLE_ARN` — IAM role trusted by GitHub Actions OIDC

The role needs ECR push permissions for the six `waytocanada-*` repositories. The EC2 instance profile needs ECR read permissions (`ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`).

Create these ECR repositories:

- `waytocanada-api`
- `waytocanada-frontend-public`
- `waytocanada-frontend-admin`
- `waytocanada-frontend-users`
- `waytocanada-frontend-consultant-site`
- `waytocanada-frontend-consultant-dash`

The existing SSH secrets remain required for the EC2 handoff: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, and optional `SSH_PORT`.

## Deployment behavior

Only services affected by the commit are built and deployed. API changes also run Laravel migrations. The EC2 host must have Docker Compose, AWS CLI, and an instance profile with ECR pull access.

Images use the commit SHA as the deployment tag. The current container image tag is captured before restart; if a health check or migration fails, that previous tag is pulled and restored.

For a manual recovery on EC2:

```bash
cd /opt/waytocanada
export ECR_REGISTRY="<account>.dkr.ecr.<region>.amazonaws.com"
export AWS_REGION="<region>"
export IMAGE_TAG="<commit-sha>"
bash deploy/deploy-from-ecr.sh "frontend-consultant-site"
```
