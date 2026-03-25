#!/bin/bash

# AWS App Runner Deployment from GitHub (No Docker Required!)
# This deploys directly from your GitHub repository

set -e

echo "🚀 AWS App Runner Deployment from GitHub"
echo "========================================"
echo ""

# Configuration
SERVICE_NAME="connected-accounts-bot-api"
REGION="${AWS_REGION:-us-east-1}"
REPOSITORY_URL="https://github.com/matthewcarter95/connectedAccountsBot"
BRANCH_NAME="main"

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GitHub Personal Access Token required!"
    echo ""
    echo "Please create a token at: https://github.com/settings/tokens/new"
    echo "Required scopes: repo"
    echo ""
    echo "Then run:"
    echo "  export GITHUB_TOKEN='your_token_here'"
    echo "  ./deploy-backend-github.sh"
    echo ""
    exit 1
fi

echo "📋 Configuration:"
echo "   Service Name:  $SERVICE_NAME"
echo "   Repository:    $REPOSITORY_URL"
echo "   Branch:        $BRANCH_NAME"
echo "   Region:        $REGION"
echo ""

# Check if service already exists
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
        echo "⏳ Waiting for deletion to complete..."
        sleep 30
    else
        echo "❌ Cancelled. Service already exists."
        exit 1
    fi
fi

# Create IAM roles
echo "🔐 Setting up IAM roles..."

# Instance role (for the application)
INSTANCE_ROLE_NAME="AppRunnerInstanceRole-${SERVICE_NAME}"
if ! aws iam get-role --role-name "$INSTANCE_ROLE_NAME" >/dev/null 2>&1; then
    echo "   Creating instance role..."
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
fi
INSTANCE_ROLE_ARN=$(aws iam get-role --role-name "$INSTANCE_ROLE_NAME" --query 'Role.Arn' --output text)

echo "✅ IAM roles ready"
echo ""

# Create connection to GitHub
echo "🔗 Creating GitHub connection..."

# Create the connection
CONNECTION_NAME="github-${SERVICE_NAME}"
CONNECTION_ARN=$(aws apprunner create-connection \
    --connection-name "$CONNECTION_NAME" \
    --provider-type GITHUB \
    --region "$REGION" \
    --query 'Connection.ConnectionArn' \
    --output text 2>/dev/null || \
    aws apprunner list-connections --region "$REGION" \
        --query "ConnectionSummaryList[?ConnectionName=='$CONNECTION_NAME'].ConnectionArn" \
        --output text)

if [ -n "$CONNECTION_ARN" ]; then
    echo "✅ GitHub connection ready: $CONNECTION_NAME"
else
    echo "❌ Failed to create GitHub connection"
    exit 1
fi

# Check connection status
CONNECTION_STATUS=$(aws apprunner describe-connection \
    --connection-arn "$CONNECTION_ARN" \
    --region "$REGION" \
    --query 'Connection.Status' \
    --output text)

if [ "$CONNECTION_STATUS" != "AVAILABLE" ]; then
    echo "⚠️  GitHub connection requires manual authorization"
    echo ""
    echo "Please complete these steps:"
    echo "1. Go to: https://console.aws.amazon.com/apprunner/home?region=$REGION#/connections"
    echo "2. Find connection: $CONNECTION_NAME"
    echo "3. Click 'Complete handshake' and authorize with GitHub"
    echo "4. Come back and run this script again"
    echo ""
    exit 0
fi

echo ""
echo "✨ Creating App Runner service from GitHub..."

# Create service configuration
cat > /tmp/apprunner-github-config.json <<EOF
{
    "ServiceName": "$SERVICE_NAME",
    "SourceConfiguration": {
        "CodeRepository": {
            "RepositoryUrl": "$REPOSITORY_URL",
            "SourceCodeVersion": {
                "Type": "BRANCH",
                "Value": "$BRANCH_NAME"
            },
            "CodeConfiguration": {
                "ConfigurationSource": "API",
                "CodeConfigurationValues": {
                    "Runtime": "NODEJS_18",
                    "BuildCommand": "cd packages/backend && npm ci && npx prisma generate && npm run build",
                    "StartCommand": "cd packages/backend && node dist/app.js",
                    "Port": "3001",
                    "RuntimeEnvironmentVariables": {
                        "NODE_ENV": "production",
                        "PORT": "3001"
                    }
                }
            },
            "SourceDirectory": "/"
        },
        "AutoDeploymentsEnabled": true,
        "AuthenticationConfiguration": {
            "ConnectionArn": "$CONNECTION_ARN"
        }
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

SERVICE_ARN=$(aws apprunner create-service \
    --region "$REGION" \
    --cli-input-json file:///tmp/apprunner-github-config.json \
    --query 'Service.ServiceArn' \
    --output text)

echo "✅ Service created: $SERVICE_ARN"
rm /tmp/apprunner-github-config.json

# Wait for service to be ready
echo ""
echo "⏳ Waiting for initial deployment (this may take 5-10 minutes)..."
echo "   Building from source and starting service..."

aws apprunner wait service-running --service-arn "$SERVICE_ARN" --region "$REGION" 2>/dev/null || true

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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Set environment variables:"
echo "   - Go to App Runner console"
echo "   - Click Configuration → Environment variables"
echo "   - Add required variables (see below)"
echo "   - Click Save and deploy"
echo ""
echo "2. Required Environment Variables:"
echo "   AUTH0_DOMAIN"
echo "   AUTH0_API_CLIENT_ID"
echo "   AUTH0_API_CLIENT_SECRET"
echo "   AUTH0_AUDIENCE"
echo "   AUTH0_ISSUER_BASE_URL"
echo "   DATABASE_URL"
echo "   OPENAI_API_KEY"
echo "   FRONTEND_URL"
echo ""
echo "3. Update Amplify frontend:"
echo "   Set VITE_API_BASE_URL=https://$SERVICE_URL"
echo ""
echo "4. Test the API:"
echo "   curl https://$SERVICE_URL/api/health"
echo ""
echo "🎉 Your backend is now deployed and will auto-update on every push to $BRANCH_NAME!"
echo ""
