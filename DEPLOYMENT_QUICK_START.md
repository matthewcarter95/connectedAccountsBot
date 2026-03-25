# Quick Start: Deploy Your App to AWS

Two simple scripts to deploy your full application to AWS.

## Prerequisites

- ✅ AWS CLI installed and configured (already done!)
- ✅ Code pushed to GitHub (already done!)
- GitHub Personal Access Token (get one if needed)

## Step 1: Deploy Frontend to Amplify

**Status:** Ready to deploy via AWS Console

1. **Open AWS Amplify Console**
   ```
   https://console.aws.amazon.com/amplify/
   ```

2. **Click "New app" → "Host web app"**

3. **Select GitHub** and authorize AWS Amplify

4. **Choose your repository:**
   - Repository: `matthewcarter95/connectedAccountsBot`
   - Branch: `main`

5. **Review build settings** (amplify.yml is auto-detected)

6. **Click "Save and deploy"**

7. **After deployment completes, add environment variables:**
   - Go to: App Settings → Environment variables
   - Add these variables:
     ```
     VITE_AUTH0_DOMAIN=your-tenant.auth0.com
     VITE_AUTH0_CLIENT_ID=your-auth0-client-id
     VITE_AUTH0_AUDIENCE=https://api.yourdomain.com
     VITE_AUTH0_REDIRECT_URI=https://main.[your-app-id].amplifyapp.com
     VITE_SUPABASE_URL=https://bkzrwdoghjgbqezwkfkz.supabase.co
     VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-key
     VITE_API_BASE_URL=https://[backend-url] (add after Step 2)
     ```
   - Click "Save" and redeploy

**Result:** Your frontend will be live at `https://main.[app-id].amplifyapp.com`

---

## Step 2: Deploy Backend to App Runner (No Docker Required!)

### Option A: GitHub Source Deployment (Recommended - No Docker Needed)

This builds your code in the cloud, no Docker installation required!

```bash
# 1. Get GitHub Personal Access Token
# Visit: https://github.com/settings/tokens/new
# Scopes needed: repo

# 2. Export token
export GITHUB_TOKEN='your_github_token_here'

# 3. Run deployment
./deploy-backend-github.sh
```

**First time setup:** The script will create a GitHub connection. You'll need to authorize it once in the AWS Console (script will provide the link).

### Option B: Docker Image Deployment (If you have Docker installed)

```bash
# Requires Docker running locally
./deploy-backend-apprunner.sh
```

---

## Step 3: Configure Backend Environment Variables

After backend deployment completes:

1. **Go to App Runner Console:**
   ```
   https://console.aws.amazon.com/apprunner/
   ```

2. **Select your service:** `connected-accounts-bot-api`

3. **Go to: Configuration → Environment variables**

4. **Add these variables:**
   ```
   AUTH0_DOMAIN=your-tenant.auth0.com
   AUTH0_API_CLIENT_ID=your-m2m-client-id
   AUTH0_API_CLIENT_SECRET=your-m2m-client-secret
   AUTH0_AUDIENCE=https://api.yourdomain.com
   AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
   DATABASE_URL=postgresql://user:pass@db.bkzrwdoghjgbqezwkfkz.supabase.co:5432/postgres
   OPENAI_API_KEY=sk-xxx
   FRONTEND_URL=https://main.[your-amplify-app-id].amplifyapp.com
   ```

5. **Click "Save" and the service will redeploy**

---

## Step 4: Connect Frontend to Backend

1. **Copy your backend URL** from App Runner console
   - Format: `https://xxxxx.us-east-1.awsapprunner.com`

2. **Update Amplify environment variables:**
   - Go to: Amplify Console → Your App → Environment variables
   - Update `VITE_API_BASE_URL` to your backend URL
   - Click "Save" and redeploy

---

## Step 5: Test Your Deployment

### Test Backend
```bash
# Health check
curl https://your-backend-url.awsapprunner.com/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Test Frontend
Visit your Amplify URL: `https://main.[app-id].amplifyapp.com`

---

## Architecture Overview

```
User Browser
     │
     ▼
┌──────────────────┐
│  AWS Amplify     │  ← React Frontend (Static)
│  CloudFront CDN  │
└────────┬─────────┘
         │ HTTPS API Calls
         ▼
┌──────────────────┐
│  AWS App Runner  │  ← Express Backend (Container)
│  Auto-scaling    │
└────────┬─────────┘
         │
         ├─────────┐
         ▼         ▼
    ┌────────┐  ┌────────┐
    │Supabase│  │ Auth0  │
    │   DB   │  │  IAM   │
    └────────┘  └────────┘
```

---

## Cost Estimate

**AWS Amplify (Frontend):**
- Free tier: 1000 build minutes, 15GB served/month
- Beyond free tier: ~$5-10/month

**AWS App Runner (Backend):**
- 1 vCPU + 2GB memory: ~$62/month
- Requests: $0.40 per million
- Total: ~$65-75/month

**Combined estimate: $70-85/month** (after free tier)

---

## Automatic Deployments

Both services auto-deploy on git push to `main`:
- **Amplify:** Rebuilds frontend automatically
- **App Runner:** Rebuilds backend automatically (if using GitHub deployment)

Just push your code and both environments update!

```bash
git add .
git commit -m "Update feature"
git push origin main
# Both frontend and backend will deploy automatically!
```

---

## Monitoring & Logs

### Frontend Logs
```bash
# Amplify Console → Your App → Build history → Click build → View logs
```

### Backend Logs
```bash
# App Runner Console → Service → Logs tab
# Or via CLI:
aws logs tail "/aws/apprunner/connected-accounts-bot-api/application" --follow
```

---

## Troubleshooting

### Frontend not connecting to backend
1. Check CORS configuration in backend
2. Verify `VITE_API_BASE_URL` in Amplify environment variables
3. Ensure backend health check passes

### Backend build fails
1. Check App Runner logs
2. Verify all dependencies in package.json
3. Check DATABASE_URL is accessible

### Auth0 errors
1. Verify all Auth0 environment variables
2. Check Auth0 application settings match URLs
3. Ensure Auth0 callback URLs include your Amplify URL

---

## Need Help?

- **Amplify Docs:** https://docs.aws.amazon.com/amplify/
- **App Runner Docs:** https://docs.aws.amazon.com/apprunner/
- **Detailed guides:** See `AMPLIFY_DEPLOYMENT.md` and `APPRUNNER_DEPLOYMENT.md`

---

## Summary Commands

```bash
# 1. Deploy frontend (via AWS Console - one time setup)
# Visit: https://console.aws.amazon.com/amplify/

# 2. Deploy backend
export GITHUB_TOKEN='your_token'
./deploy-backend-github.sh

# 3. Test
curl https://your-backend-url/api/health

# 4. Done! 🎉
```
