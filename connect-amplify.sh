#!/bin/bash

# Connect Amplify to GitHub and deploy
# Requires: GITHUB_TOKEN environment variable

set -e

APP_ID="d31j18appddvyo"
REGION="us-east-1"
BRANCH="main"
REPO="matthewcarter95/connectedAccountsBot"

echo "🚀 Connecting Amplify to GitHub"
echo "================================"
echo ""

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GitHub Personal Access Token required!"
    echo ""
    echo "1. Create token at: https://github.com/settings/tokens/new"
    echo "   Required scope: repo"
    echo ""
    echo "2. Export the token:"
    echo "   export GITHUB_TOKEN='your_token_here'"
    echo ""
    echo "3. Run this script again"
    echo ""
    exit 1
fi

echo "📝 Configuration:"
echo "   App ID: $APP_ID"
echo "   Repository: $REPO"
echo "   Branch: $BRANCH"
echo ""

# Connect repository
echo "🔗 Connecting GitHub repository..."
aws amplify update-app \
  --app-id "$APP_ID" \
  --region "$REGION" \
  --repository "https://github.com/$REPO" \
  --access-token "$GITHUB_TOKEN" \
  --enable-branch-auto-build > /dev/null

echo "✅ Repository connected"

# Create branch
echo "🌿 Creating branch..."
aws amplify create-branch \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --region "$REGION" \
  --enable-auto-build > /dev/null

echo "✅ Branch created"

# Set environment variables
echo "⚙️  Setting environment variables..."
cat > /tmp/amplify-env.json <<'ENVEOF'
{
  "VITE_AUTH0_DOMAIN": "myid-selfservice.cic-demo-platform.auth0app.com",
  "VITE_AUTH0_CLIENT_ID": "KFI6neceAPPNmBJnd2YSCBN8ECvLDdpD",
  "VITE_AUTH0_AUDIENCE": "api://discordGoogleConnectedAccounts",
  "VITE_AUTH0_REDIRECT_URI": "https://main.d31j18appddvyo.amplifyapp.com",
  "VITE_API_BASE_URL": "https://ueppzif6ym.us-east-1.awsapprunner.com",
  "VITE_SUPABASE_URL": "https://bkzrwdoghjgbqezwkfkz.supabase.co",
  "VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY": "sb_publishable_lZLU1glfEYfp7rn5u9vKwg_YBv_1HGW"
}
ENVEOF

aws amplify update-branch \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --region "$REGION" \
  --cli-input-json "$(cat /tmp/amplify-env.json | jq '{environmentVariables: .}')"

rm /tmp/amplify-env.json
echo "✅ Environment variables set"

# Start deployment
echo "🚀 Starting deployment..."
JOB_ID=$(aws amplify start-job \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-type RELEASE \
  --region "$REGION" \
  --query 'jobSummary.jobId' \
  --output text)

echo "✅ Deployment started: Job ID $JOB_ID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Deployment Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Frontend URL: https://main.d31j18appddvyo.amplifyapp.com"
echo "Backend API:  https://ueppzif6ym.us-east-1.awsapprunner.com"
echo ""
echo "🌐 Console: https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_ID"
echo ""
echo "⏳ Check deployment status:"
echo "   aws amplify get-job --app-id $APP_ID --branch-name $BRANCH --job-id $JOB_ID --region $REGION"
echo ""
echo "📝 Don't forget to update Auth0 with the Amplify URL!"
echo ""
