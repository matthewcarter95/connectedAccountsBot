#!/bin/bash

# AWS App Runner Deployment Script for Backend
# This script builds, pushes to ECR, and deploys to App Runner

set -e

echo "🚀 AWS App Runner Backend Deployment"
echo "====================================="
echo ""

# Configuration
SERVICE_NAME="connected-accounts-bot-api"
REGION="${AWS_REGION:-us-east-1}"
ECR_REPO_NAME="connected-accounts-bot-backend"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE_TAG="${IMAGE_TAG:-latest}"
FULL_IMAGE="${ECR_REGISTRY}/${ECR_REPO_NAME}:${IMAGE_TAG}"

echo "📋 Configuration:"
echo "   Service Name:  $SERVICE_NAME"
echo "   Region:        $REGION"
echo "   AWS Account:   $ACCOUNT_ID"
echo "   ECR Registry:  $ECR_REGISTRY"
echo "   Image Tag:     $IMAGE_TAG"
echo ""

# Check if ECR repository exists, create if not
echo "🔍 Checking ECR repository..."
if ! aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$REGION" >/dev/null 2>&1; then
    echo "✨ Creating ECR repository: $ECR_REPO_NAME"
    aws ecr create-repository \
        --repository-name "$ECR_REPO_NAME" \
        --region "$REGION" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256
    echo "✅ ECR repository created"
else
    echo "✅ ECR repository exists"
fi

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region "$REGION" | \
    docker login --username AWS --password-stdin "$ECR_REGISTRY"
echo "✅ Logged in to ECR"

# Build Docker image (from root to handle monorepo)
echo "🔨 Building Docker image..."
docker build --platform linux/amd64 -f packages/backend/Dockerfile -t "$ECR_REPO_NAME:$IMAGE_TAG" .
docker tag "$ECR_REPO_NAME:$IMAGE_TAG" "$FULL_IMAGE"
echo "✅ Docker image built"

# Push to ECR
echo "📤 Pushing image to ECR..."
docker push "$FULL_IMAGE"
echo "✅ Image pushed to ECR"

# Check if App Runner service exists
echo "🔍 Checking App Runner service..."
SERVICE_ARN=$(aws apprunner list-services --region "$REGION" --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text 2>/dev/null || echo "")

if [ -z "$SERVICE_ARN" ]; then
    echo "✨ Creating new App Runner service..."

    # Create IAM roles if they don't exist
    echo "🔐 Setting up IAM roles..."

    # Instance role (for the application to access AWS services)
    INSTANCE_ROLE_NAME="AppRunnerInstanceRole-${SERVICE_NAME}"
    if ! aws iam get-role --role-name "$INSTANCE_ROLE_NAME" >/dev/null 2>&1; then
        echo "Creating instance role..."
        aws iam create-role \
            --role-name "$INSTANCE_ROLE_NAME" \
            --assume-role-policy-document '{
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Principal": {"Service": "tasks.apprunner.amazonaws.com"},
                    "Action": "sts:AssumeRole"
                }]
            }' >/dev/null

        # Attach basic policies if needed (for Secrets Manager, etc.)
        # aws iam attach-role-policy --role-name "$INSTANCE_ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/SecretsManagerReadWrite"
    fi
    INSTANCE_ROLE_ARN=$(aws iam get-role --role-name "$INSTANCE_ROLE_NAME" --query 'Role.Arn' --output text)

    # Access role (for App Runner to access ECR)
    ACCESS_ROLE_NAME="AppRunnerECRAccessRole"
    if ! aws iam get-role --role-name "$ACCESS_ROLE_NAME" >/dev/null 2>&1; then
        echo "Creating ECR access role..."
        aws iam create-role \
            --role-name "$ACCESS_ROLE_NAME" \
            --assume-role-policy-document '{
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Principal": {"Service": "build.apprunner.amazonaws.com"},
                    "Action": "sts:AssumeRole"
                }]
            }' >/dev/null

        aws iam attach-role-policy \
            --role-name "$ACCESS_ROLE_NAME" \
            --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
    fi
    ACCESS_ROLE_ARN=$(aws iam get-role --role-name "$ACCESS_ROLE_NAME" --query 'Role.Arn' --output text)

    echo "✅ IAM roles ready"
    echo "   Instance Role: $INSTANCE_ROLE_ARN"
    echo "   Access Role:   $ACCESS_ROLE_ARN"

    # Create service configuration file
    cat > /tmp/apprunner-config.json <<EOF
{
    "ServiceName": "$SERVICE_NAME",
    "SourceConfiguration": {
        "ImageRepository": {
            "ImageIdentifier": "$FULL_IMAGE",
            "ImageRepositoryType": "ECR",
            "ImageConfiguration": {
                "Port": "3001",
                "RuntimeEnvironmentVariables": {
                    "NODE_ENV": "production",
                    "PORT": "3001"
                }
            }
        },
        "AuthenticationConfiguration": {
            "AccessRoleArn": "$ACCESS_ROLE_ARN"
        },
        "AutoDeploymentsEnabled": true
    },
    "InstanceConfiguration": {
        "Cpu": "1 vCPU",
        "Memory": "2 GB",
        "InstanceRoleArn": "$INSTANCE_ROLE_ARN"
    },
    "HealthCheckConfiguration": {
        "Protocol": "HTTP",
        "Path": "/api/health",
        "Interval": 10,
        "Timeout": 5,
        "HealthyThreshold": 1,
        "UnhealthyThreshold": 5
    }
}
EOF

    echo "🚀 Creating App Runner service..."
    SERVICE_ARN=$(aws apprunner create-service \
        --region "$REGION" \
        --cli-input-json file:///tmp/apprunner-config.json \
        --query 'Service.ServiceArn' \
        --output text)

    echo "✅ Service created: $SERVICE_ARN"
    rm /tmp/apprunner-config.json
else
    echo "✅ Found existing service: $SERVICE_ARN"
    echo "🔄 Updating service with new image..."

    aws apprunner update-service \
        --region "$REGION" \
        --service-arn "$SERVICE_ARN" \
        --source-configuration "ImageRepository={ImageIdentifier=$FULL_IMAGE,ImageRepositoryType=ECR,ImageConfiguration={Port=3001}}" \
        >/dev/null

    echo "✅ Service update initiated"
fi

# Wait for service to be ready
echo "⏳ Waiting for service to be running..."
aws apprunner wait service-running --service-arn "$SERVICE_ARN" --region "$REGION" || true

# Get service details
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SERVICE_URL=$(aws apprunner describe-service \
    --service-arn "$SERVICE_ARN" \
    --region "$REGION" \
    --query 'Service.ServiceUrl' \
    --output text)

echo "Service ARN:  $SERVICE_ARN"
echo "Service URL:  https://$SERVICE_URL"
echo "Health Check: https://$SERVICE_URL/api/health"
echo ""
echo "🌐 Console URL:"
echo "   https://console.aws.amazon.com/apprunner/home?region=$REGION#/services/$SERVICE_ARN"
echo ""
echo "⚙️  Next Steps:"
echo "   1. Configure environment variables in App Runner console"
echo "   2. Test the API: curl https://$SERVICE_URL/api/health"
echo "   3. Update frontend VITE_API_BASE_URL to: https://$SERVICE_URL"
echo ""
echo "📝 Required Environment Variables:"
echo "   - AUTH0_DOMAIN"
echo "   - AUTH0_API_CLIENT_ID"
echo "   - AUTH0_API_CLIENT_SECRET"
echo "   - AUTH0_AUDIENCE"
echo "   - AUTH0_ISSUER_BASE_URL"
echo "   - DATABASE_URL"
echo "   - OPENAI_API_KEY"
echo "   - FRONTEND_URL (set to your Amplify URL)"
echo ""
