#!/bin/bash

# AWS App Runner Deployment with Environment Variables
# This script creates the service with all required env vars from the start

set -e

echo "🚀 AWS App Runner Backend Deployment (with Environment Variables)"
echo "=================================================================="
echo ""

# Configuration
SERVICE_NAME="connected-accounts-bot-api"
REGION="${AWS_REGION:-us-east-1}"
ECR_REPO_NAME="connected-accounts-bot-backend"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE_TAG="${IMAGE_TAG:-latest}"
FULL_IMAGE="${ECR_REGISTRY}/${ECR_REPO_NAME}:${IMAGE_TAG}"

# Load environment variables from backend .env file
ENV_FILE="packages/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    exit 1
fi

echo "📋 Loading environment variables from $ENV_FILE"

# Parse .env file into JSON format for AWS CLI
ENV_JSON=$(grep -v '^#' "$ENV_FILE" | grep -v '^$' | grep '=' | while IFS='=' read -r key value; do
    # Remove quotes from value if present
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    # Skip PORT - App Runner manages this
    if [ "$key" != "PORT" ]; then
        echo "\"$key\": \"$value\""
    fi
done | paste -sd ',' -)

# Add required runtime variables
ENV_JSON="{ \"NODE_ENV\": \"production\", \"PORT\": \"3001\", $ENV_JSON }"

echo "📋 Configuration:"
echo "   Service Name:  $SERVICE_NAME"
echo "   Region:        $REGION"
echo "   Image:         $FULL_IMAGE"
echo ""

# Check if ECR image exists
echo "🔍 Verifying ECR image..."
if ! aws ecr describe-images --repository-name "$ECR_REPO_NAME" --image-ids imageTag="$IMAGE_TAG" --region "$REGION" >/dev/null 2>&1; then
    echo "❌ Docker image not found in ECR"
    echo "   Please run: ./deploy-backend-apprunner.sh first to build and push the image"
    exit 1
fi
echo "✅ ECR image found"

# Check if App Runner service exists
echo "🔍 Checking for existing service..."
SERVICE_ARN=$(aws apprunner list-services --region "$REGION" \
    --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" \
    --output text 2>/dev/null || echo "")

if [ -n "$SERVICE_ARN" ]; then
    echo "⚠️  Service already exists: $SERVICE_ARN"
    echo ""
    read -p "Do you want to delete and recreate it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Deleting existing service..."
        aws apprunner delete-service --service-arn "$SERVICE_ARN" --region "$REGION" > /dev/null
        echo "⏳ Waiting for deletion to complete (30 seconds)..."
        sleep 30
    else
        echo "❌ Cancelled."
        exit 1
    fi
fi

# Get IAM role ARNs
echo "🔐 Getting IAM roles..."
INSTANCE_ROLE_ARN=$(aws iam get-role --role-name "AppRunnerInstanceRole-${SERVICE_NAME}" --query 'Role.Arn' --output text 2>/dev/null || echo "")
ACCESS_ROLE_ARN=$(aws iam get-role --role-name "AppRunnerECRAccessRole" --query 'Role.Arn' --output text 2>/dev/null || echo "")

if [ -z "$INSTANCE_ROLE_ARN" ] || [ -z "$ACCESS_ROLE_ARN" ]; then
    echo "❌ IAM roles not found. Please run ./deploy-backend-apprunner.sh first to create them."
    exit 1
fi

echo "✅ IAM roles ready"

# Create service configuration
cat > /tmp/apprunner-config-with-env.json <<EOF
{
    "ServiceName": "$SERVICE_NAME",
    "SourceConfiguration": {
        "ImageRepository": {
            "ImageIdentifier": "$FULL_IMAGE",
            "ImageRepositoryType": "ECR",
            "ImageConfiguration": {
                "Port": "3001",
                "RuntimeEnvironmentVariables": $ENV_JSON
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

echo "🚀 Creating App Runner service with environment variables..."
SERVICE_ARN=$(aws apprunner create-service \
    --region "$REGION" \
    --cli-input-json file:///tmp/apprunner-config-with-env.json \
    --query 'Service.ServiceArn' \
    --output text)

echo "✅ Service created: $SERVICE_ARN"
rm /tmp/apprunner-config-with-env.json

# Wait for service to be ready
echo ""
echo "⏳ Waiting for service to start (this may take 3-5 minutes)..."
echo "   Pulling image, starting container, running health checks..."
echo ""

# Poll service status
MAX_WAIT=300  # 5 minutes
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$(aws apprunner describe-service --service-arn "$SERVICE_ARN" --region "$REGION" --query 'Service.Status' --output text)

    if [ "$STATUS" = "RUNNING" ]; then
        echo "✅ Service is running!"
        break
    elif [ "$STATUS" = "CREATE_FAILED" ] || [ "$STATUS" = "OPERATION_FAILED" ]; then
        echo "❌ Service creation failed. Check logs:"
        echo "   aws logs tail /aws/apprunner/$SERVICE_NAME/$(basename $SERVICE_ARN)/application --region $REGION --follow"
        exit 1
    else
        echo "   Status: $STATUS (waiting... ${ELAPSED}s elapsed)"
        sleep 10
        ELAPSED=$((ELAPSED + 10))
    fi
done

# Get service details
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SERVICE_URL=$(aws apprunner describe-service \
    --service-arn "$SERVICE_ARN" \
    --region "$REGION" \
    --query 'Service.ServiceUrl' \
    --output text)

echo ""
echo "🌐 Service URL:   https://$SERVICE_URL"
echo "💚 Health Check:  https://$SERVICE_URL/api/health"
echo ""
echo "📊 Console: https://console.aws.amazon.com/apprunner/home?region=$REGION#/services/$SERVICE_ARN"
echo ""
echo "🧪 Test the API:"
echo "   curl https://$SERVICE_URL/api/health"
echo ""
echo "📝 Next: Update Amplify frontend with:"
echo "   VITE_API_BASE_URL=https://$SERVICE_URL"
echo ""
