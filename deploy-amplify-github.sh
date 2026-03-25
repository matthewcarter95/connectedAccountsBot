#!/bin/bash

# Amplify GitHub Deployment Script
# Prerequisites: GitHub Personal Access Token with repo permissions

set -e

echo "🚀 AWS Amplify Deployment Script"
echo "=================================="
echo ""

# Configuration
APP_NAME="connected-accounts-bot"
REPOSITORY_URL="https://github.com/matthewcarter95/connectedAccountsBot"
BRANCH_NAME="main"
REGION="us-east-1"

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GitHub Personal Access Token not found!"
    echo ""
    echo "Please create a token at: https://github.com/settings/tokens"
    echo "Required scopes: repo, admin:repo_hook"
    echo ""
    echo "Then export it:"
    echo "  export GITHUB_TOKEN='your_token_here'"
    echo ""
    exit 1
fi

# Check if Amplify app exists
echo "📋 Checking for existing Amplify app..."
EXISTING_APP=$(aws amplify list-apps --region "$REGION" --query "apps[?name=='${APP_NAME}'].appId" --output text 2>/dev/null || echo "")

if [ -z "$EXISTING_APP" ]; then
    echo "✨ Creating new Amplify app with GitHub connection..."

    APP_ID=$(aws amplify create-app \
        --region "$REGION" \
        --name "$APP_NAME" \
        --description "Discord bot that bridges Google Email with Discord channels" \
        --repository "$REPOSITORY_URL" \
        --access-token "$GITHUB_TOKEN" \
        --enable-branch-auto-build \
        --enable-branch-auto-deletion \
        --enable-basic-auth false \
        --query 'app.appId' \
        --output text)

    echo "✅ Created Amplify app: $APP_ID"
else
    APP_ID=$EXISTING_APP
    echo "✅ Found existing app: $APP_ID"
fi

# Create or update branch
echo "🌿 Setting up branch: $BRANCH_NAME"
EXISTING_BRANCH=$(aws amplify list-branches --region "$REGION" --app-id "$APP_ID" --query "branches[?branchName=='${BRANCH_NAME}'].branchName" --output text 2>/dev/null || echo "")

if [ -z "$EXISTING_BRANCH" ]; then
    aws amplify create-branch \
        --region "$REGION" \
        --app-id "$APP_ID" \
        --branch-name "$BRANCH_NAME" \
        --enable-auto-build \
        --enable-pull-request-preview false

    echo "✅ Branch created: $BRANCH_NAME"
else
    echo "✅ Branch already exists: $BRANCH_NAME"
fi

# Trigger a build
echo "🔨 Starting build..."
JOB_ID=$(aws amplify start-job \
    --region "$REGION" \
    --app-id "$APP_ID" \
    --branch-name "$BRANCH_NAME" \
    --job-type RELEASE \
    --query 'jobSummary.jobId' \
    --output text)

echo "✅ Build job started: $JOB_ID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Deployment Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "App ID:     $APP_ID"
echo "Branch:     $BRANCH_NAME"
echo "Job ID:     $JOB_ID"
echo "Region:     $REGION"
echo ""
echo "🌐 Console URL:"
echo "   https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_ID"
echo ""
echo "⏳ Build status:"
echo "   aws amplify get-job --app-id $APP_ID --branch-name $BRANCH_NAME --job-id $JOB_ID --region $REGION"
echo ""
echo "🔗 Once deployed, your app URL will be:"
echo "   https://$BRANCH_NAME.$APP_ID.amplifyapp.com"
echo ""
