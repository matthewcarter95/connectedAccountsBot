# AWS Amplify Deployment Guide

This guide covers deploying the Connected Accounts Bot to AWS Amplify.

## Architecture

- **Frontend**: React + Vite app deployed to Amplify Hosting
- **Backend**: Express.js API (needs separate deployment - see Backend Deployment section)

## Prerequisites

1. AWS CLI installed and configured
2. GitHub repository with your code
3. AWS account with Amplify permissions

## Method 1: Deploy via AWS Console (Easiest)

1. **Push your code to GitHub** (already done)
   ```bash
   git add amplify.yml
   git commit -m "Add Amplify configuration"
   git push origin main
   ```

2. **Open AWS Amplify Console**
   - Go to: https://console.aws.amazon.com/amplify/
   - Click "New app" → "Host web app"
   - Select "GitHub" and authorize AWS Amplify
   - Choose repository: `matthewcarter95/connectedAccountsBot`
   - Choose branch: `main`

3. **Configure build settings**
   - Amplify will auto-detect the `amplify.yml` file
   - Review the build settings
   - Click "Save and deploy"

4. **Set environment variables** (if needed for frontend)
   - Go to App Settings → Environment variables
   - Add your Auth0, Supabase, and API endpoint variables

## Method 2: Deploy via AWS CLI with GitHub Connection

1. **Create a GitHub Personal Access Token**
   - Go to: https://github.com/settings/tokens/new
   - Select scopes: `repo`, `admin:repo_hook`
   - Copy the token

2. **Export the token**
   ```bash
   export GITHUB_TOKEN='your_github_token_here'
   ```

3. **Run the deployment script**
   ```bash
   chmod +x deploy-amplify-github.sh
   ./deploy-amplify-github.sh
   ```

## Method 3: Manual AWS CLI Commands

```bash
# Create the app
aws amplify create-app \
  --name "connected-accounts-bot" \
  --repository "https://github.com/matthewcarter95/connectedAccountsBot" \
  --access-token "$GITHUB_TOKEN" \
  --enable-branch-auto-build

# Note the APP_ID from the output

# Create a branch
aws amplify create-branch \
  --app-id "YOUR_APP_ID" \
  --branch-name "main" \
  --enable-auto-build

# Start a build
aws amplify start-job \
  --app-id "YOUR_APP_ID" \
  --branch-name "main" \
  --job-type RELEASE
```

## Environment Variables

Add these in Amplify Console → App Settings → Environment variables:

```
VITE_AUTH0_DOMAIN=your-auth0-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=your-backend-api-url
```

## Backend Deployment Options

The backend (Express API) needs separate deployment. Options:

### Option 1: AWS Lambda + API Gateway
- Serverless, pay-per-use
- Use AWS SAM or Serverless Framework
- Good for variable traffic

### Option 2: AWS App Runner
- Easiest for containerized apps
- Automatic scaling
- Direct Docker support

```bash
# Build and deploy to App Runner
cd packages/backend
aws apprunner create-service \
  --service-name "connected-accounts-bot-api" \
  --source-configuration file://apprunner.json
```

### Option 3: AWS ECS Fargate
- More control over containers
- Better for complex deployments
- Supports long-running processes

### Option 4: AWS Elastic Beanstalk
- Traditional Node.js hosting
- Auto-scaling
- Easy deployment

```bash
# Deploy to Elastic Beanstalk
cd packages/backend
eb init -p node.js connected-accounts-bot
eb create connected-accounts-bot-env
```

## Monitoring and Logs

View logs in Amplify Console or via CLI:

```bash
# Get app info
aws amplify get-app --app-id YOUR_APP_ID

# List branches
aws amplify list-branches --app-id YOUR_APP_ID

# View build job status
aws amplify get-job \
  --app-id YOUR_APP_ID \
  --branch-name main \
  --job-id JOB_ID
```

## Custom Domain (Optional)

1. Go to Amplify Console → Domain management
2. Add your custom domain
3. Follow DNS configuration instructions

## Troubleshooting

### Build Fails
- Check build logs in Amplify Console
- Verify `amplify.yml` configuration
- Ensure all dependencies are in package.json

### Environment Variables Not Working
- Prefix frontend vars with `VITE_`
- Redeploy after adding variables

### Backend Connection Issues
- Update `VITE_API_URL` in Amplify environment variables
- Ensure CORS is configured in backend
- Check backend deployment status

## Cost Estimate

AWS Amplify Hosting pricing:
- Build: $0.01 per build minute
- Hosting: $0.15 per GB stored + $0.15 per GB served
- Free tier: 1000 build minutes, 15 GB served per month

For this app, estimated cost: **$5-10/month** (with free tier)

## Next Steps

1. Deploy frontend to Amplify
2. Choose and deploy backend
3. Update frontend environment variables with backend URL
4. Test the full application
5. Set up monitoring and alerts
