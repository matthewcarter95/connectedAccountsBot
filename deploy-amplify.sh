#!/bin/bash

# Amplify Deployment Script
# This script deploys the frontend to AWS Amplify

set -e

echo "🚀 Starting Amplify Deployment..."

# Configuration
APP_NAME="connected-accounts-bot"
REPOSITORY_URL="https://github.com/matthewcarter95/connectedAccountsBot"
BRANCH_NAME="main"

# Check if Amplify app exists
echo "📋 Checking for existing Amplify app..."
EXISTING_APP=$(aws amplify list-apps --query "apps[?name=='${APP_NAME}'].appId" --output text 2>/dev/null || echo "")

if [ -z "$EXISTING_APP" ]; then
    echo "✨ Creating new Amplify app..."

    # Option 1: Create app without GitHub connection (manual deployment)
    APP_ID=$(aws amplify create-app \
        --name "$APP_NAME" \
        --description "Discord bot that bridges Google Email with Discord channels" \
        --platform "WEB" \
        --enable-branch-auto-build \
        --query 'app.appId' \
        --output text)

    echo "✅ Created Amplify app: $APP_ID"

    # Create a branch
    echo "🌿 Creating branch..."
    aws amplify create-branch \
        --app-id "$APP_ID" \
        --branch-name "$BRANCH_NAME" \
        --enable-auto-build

    echo "✅ Branch created: $BRANCH_NAME"
else
    APP_ID=$EXISTING_APP
    echo "✅ Found existing app: $APP_ID"
fi

# Build and deploy
echo "🔨 Building and deploying..."

# Option 1: Deploy from local (requires zip)
cd packages/frontend
npm run build
cd ../..

# Create deployment
aws amplify start-deployment \
    --app-id "$APP_ID" \
    --branch-name "$BRANCH_NAME" \
    --source-url "$(pwd)"

echo ""
echo "✅ Deployment initiated!"
echo "🌐 App ID: $APP_ID"
echo "📱 View your app in AWS Console:"
echo "   https://console.aws.amazon.com/amplify/home?region=us-east-1#/$APP_ID"
echo ""
echo "To view the live URL after deployment completes:"
echo "   aws amplify get-branch --app-id $APP_ID --branch-name $BRANCH_NAME --query 'branch.branchName'"
