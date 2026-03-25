# AWS App Runner Backend Deployment Guide

This guide covers deploying the Express.js backend API to AWS App Runner.

## What is AWS App Runner?

AWS App Runner is a fully managed container application service that makes it easy to deploy containerized web applications and APIs at scale. You don't need to manage infrastructure, load balancers, or orchestration.

**Benefits:**
- Automatic scaling based on traffic
- Built-in load balancing
- HTTPS by default
- Automatic deployments from container registry
- Pay only for what you use

## Prerequisites

1. **Docker installed** - Required to build container images
2. **AWS CLI configured** - Already set up with credentials
3. **Backend environment variables** - Copy `packages/backend/.env.example` to `packages/backend/.env` and fill in values

## Quick Start - Deploy Backend Now

### Step 1: Prepare Environment Variables

Update your backend `.env` file with production values:

```bash
cd packages/backend
cp .env.example .env
# Edit .env with your production values
```

Required variables:
```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_API_CLIENT_ID=your-m2m-client-id
AUTH0_API_CLIENT_SECRET=your-m2m-client-secret
AUTH0_AUDIENCE=https://api.yourdomain.com
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
DATABASE_URL=postgresql://user:pass@host:5432/db
OPENAI_API_KEY=sk-xxx
NODE_ENV=production
FRONTEND_URL=https://your-amplify-app-url.amplifyapp.com
```

### Step 2: Deploy to App Runner

```bash
# Make script executable
chmod +x deploy-backend-apprunner.sh

# Run deployment
./deploy-backend-apprunner.sh
```

This script will:
1. Create an ECR repository (if needed)
2. Build Docker image for your backend
3. Push image to ECR
4. Create App Runner service with proper IAM roles
5. Configure health checks
6. Output the service URL

**Expected time:** 5-10 minutes for first deployment

### Step 3: Configure Environment Variables

After initial deployment, set your environment variables:

```bash
chmod +x set-apprunner-env.sh
./set-apprunner-env.sh
```

Or set them manually in the AWS Console:
1. Go to [App Runner Console](https://console.aws.amazon.com/apprunner/)
2. Select your service
3. Go to Configuration → Environment variables
4. Add all required variables
5. Deploy the service again

### Step 4: Test the API

```bash
# Get your service URL from deployment output
SERVICE_URL="https://xxxxx.us-east-1.awsapprunner.com"

# Test health endpoint
curl $SERVICE_URL/api/health

# Expected response:
# {"status":"ok","timestamp":"2024-03-25T..."}
```

### Step 5: Update Frontend Configuration

Update your Amplify environment variables with the backend URL:

1. Go to Amplify Console → Your App → Environment variables
2. Update `VITE_API_BASE_URL` to your App Runner service URL
3. Redeploy the frontend

## Architecture

```
┌─────────────────┐
│  Amplify CDN    │ (React Frontend)
│  Static Assets  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   App Runner    │ (Express Backend)
│  ┌───────────┐  │
│  │  Node.js  │  │
│  │   API     │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │
         ▼
┌─────────────────┐
│    Supabase     │ (PostgreSQL)
│   Database      │
└─────────────────┘
```

## Deployment Commands Reference

### Deploy New Version

```bash
# Deploy with default "latest" tag
./deploy-backend-apprunner.sh

# Deploy with specific version tag
IMAGE_TAG=v1.2.3 ./deploy-backend-apprunner.sh
```

### Check Service Status

```bash
SERVICE_NAME="connected-accounts-bot-api"
REGION="us-east-1"

# Get service ARN
SERVICE_ARN=$(aws apprunner list-services --region $REGION \
  --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" \
  --output text)

# Describe service
aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --region $REGION

# Get service URL
aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --region $REGION \
  --query 'Service.ServiceUrl' \
  --output text
```

### View Logs

```bash
# Service logs are automatically sent to CloudWatch Logs
# View in console:
# https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups

# Or via CLI:
LOG_GROUP="/aws/apprunner/$SERVICE_NAME/application"
aws logs tail $LOG_GROUP --follow --region $REGION
```

### Update Environment Variables

```bash
# Using the script
./set-apprunner-env.sh

# Or manually via CLI
aws apprunner update-service \
  --service-arn $SERVICE_ARN \
  --region $REGION \
  --source-configuration "ImageRepository={...}"
```

### Pause/Resume Service

```bash
# Pause (stop serving traffic, no charges)
aws apprunner pause-service \
  --service-arn $SERVICE_ARN \
  --region $REGION

# Resume
aws apprunner resume-service \
  --service-arn $SERVICE_ARN \
  --region $REGION
```

### Delete Service

```bash
aws apprunner delete-service \
  --service-arn $SERVICE_ARN \
  --region $REGION
```

## Configuration Details

### Resource Sizing

Default configuration:
- **CPU:** 1 vCPU
- **Memory:** 2 GB
- **Auto-scaling:** 1-25 instances
- **Concurrency:** 100 concurrent requests per instance

To modify, edit `deploy-backend-apprunner.sh` and change:
```json
"InstanceConfiguration": {
    "Cpu": "1 vCPU",        // Options: 0.25, 0.5, 1, 2, 4 vCPU
    "Memory": "2 GB"         // Options: 0.5-12 GB (depends on CPU)
}
```

### Health Check Configuration

```json
"HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/api/health",
    "Interval": 10,          // seconds between checks
    "Timeout": 5,            // seconds to wait for response
    "HealthyThreshold": 1,   // successes needed to be healthy
    "UnhealthyThreshold": 5  // failures needed to be unhealthy
}
```

### Auto Scaling

App Runner automatically scales based on:
- Incoming request traffic
- CPU utilization
- Memory usage

Scaling happens in seconds, not minutes.

## Database Migrations

When deploying schema changes:

```bash
# Option 1: Run migrations locally
cd packages/backend
npx prisma migrate deploy

# Option 2: Add migration step to Dockerfile
# (Already included in the Dockerfile)
```

## Cost Estimates

AWS App Runner pricing (us-east-1):
- **Provisioned container:** $0.007/hour per GB of memory + $0.064/hour per vCPU
- **Requests:** $0.40 per million requests
- **Data out:** $0.15 per GB

**Example calculation:**
- 1 vCPU + 2 GB memory (active 24/7): ~$62/month
- 1 million requests: $0.40
- 10 GB data out: $1.50

**Estimated total: $65-100/month** for moderate traffic

**Cost optimization:**
- Use `pause-service` for dev/staging environments when not in use
- Scale down memory if not needed
- Monitor CloudWatch metrics for optimization opportunities

## Troubleshooting

### Deployment fails

```bash
# Check service logs
aws logs tail "/aws/apprunner/$SERVICE_NAME/application" --region $REGION

# Check service events
aws apprunner describe-service --service-arn $SERVICE_ARN \
  --query 'Service.OperationSummary' --region $REGION
```

### Health checks failing

1. Verify `/api/health` endpoint works locally
2. Check CloudWatch logs for errors
3. Ensure port 3001 is exposed correctly
4. Verify environment variables are set

### Can't access service

1. Check service status: Should be "RUNNING"
2. Test health endpoint first
3. Check CORS configuration in backend
4. Verify Auth0 configuration

### Environment variables not working

1. Verify variables are set in App Runner configuration
2. Check for typos in variable names
3. Redeploy after adding variables
4. Don't use quotes in App Runner console values

## Security Best Practices

1. **Use AWS Secrets Manager** for sensitive values
   ```bash
   # Store secret
   aws secretsmanager create-secret \
     --name "/apprunner/connected-accounts-bot/auth0-secret" \
     --secret-string "your-secret-value"

   # Reference in App Runner using ARN
   ```

2. **Enable VPC connector** for private database access
3. **Use HTTPS only** (App Runner default)
4. **Rotate credentials** regularly
5. **Enable AWS WAF** for additional protection

## Monitoring

Key metrics to watch:
- Request count
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- CPU and memory utilization
- Active instances

Access metrics:
- CloudWatch Console
- App Runner service dashboard
- Set up CloudWatch alarms for alerts

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy Backend
on:
  push:
    branches: [main]
    paths:
      - 'packages/backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Deploy to App Runner
        run: ./deploy-backend-apprunner.sh
```

## Next Steps

1. ✅ Deploy backend to App Runner
2. ✅ Test API endpoints
3. ✅ Update Amplify frontend with backend URL
4. Set up monitoring and alerts
5. Configure custom domain (optional)
6. Set up CI/CD pipeline (optional)
7. Enable AWS WAF for security (optional)
