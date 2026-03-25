#!/bin/bash

# Script to set environment variables for App Runner service
# Usage: ./set-apprunner-env.sh

set -e

SERVICE_NAME="connected-accounts-bot-api"
REGION="${AWS_REGION:-us-east-1}"

echo "🔧 Setting App Runner Environment Variables"
echo "============================================"
echo ""

# Get service ARN
SERVICE_ARN=$(aws apprunner list-services --region "$REGION" --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text)

if [ -z "$SERVICE_ARN" ]; then
    echo "❌ Service '$SERVICE_NAME' not found in region $REGION"
    echo "Please deploy the service first using ./deploy-backend-apprunner.sh"
    exit 1
fi

echo "✅ Found service: $SERVICE_ARN"
echo ""

# Check for .env file
ENV_FILE="packages/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    echo "Please create it from .env.example"
    exit 1
fi

echo "📋 Reading environment variables from $ENV_FILE"
echo ""

# Parse .env file and create JSON
# Skip comments and empty lines, extract key=value pairs
ENV_VARS=$(grep -v '^#' "$ENV_FILE" | grep -v '^$' | while IFS='=' read -r key value; do
    # Remove quotes from value if present
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

    # Skip PORT (App Runner manages this)
    if [ "$key" != "PORT" ]; then
        echo "   Setting: $key"
        echo "\"$key\": \"$value\""
    fi
done | paste -sd ',' - | sed 's/^/{ "NODE_ENV": "production", "PORT": "3001", /' | sed 's/$/}/')

echo ""
echo "🔄 Updating App Runner service configuration..."

# Get current service configuration
CURRENT_CONFIG=$(aws apprunner describe-service --service-arn "$SERVICE_ARN" --region "$REGION")

# Extract source configuration
IMAGE_IDENTIFIER=$(echo "$CURRENT_CONFIG" | jq -r '.Service.SourceConfiguration.ImageRepository.ImageIdentifier')

# Update service with new environment variables
aws apprunner update-service \
    --region "$REGION" \
    --service-arn "$SERVICE_ARN" \
    --source-configuration "{
        \"ImageRepository\": {
            \"ImageIdentifier\": \"$IMAGE_IDENTIFIER\",
            \"ImageRepositoryType\": \"ECR\",
            \"ImageConfiguration\": {
                \"Port\": \"3001\",
                \"RuntimeEnvironmentVariables\": $ENV_VARS
            }
        },
        \"AutoDeploymentsEnabled\": true
    }" \
    > /dev/null

echo "✅ Environment variables updated"
echo ""
echo "⏳ Service is redeploying with new configuration..."
echo "   Monitor progress: aws apprunner describe-service --service-arn $SERVICE_ARN --region $REGION"
echo ""
