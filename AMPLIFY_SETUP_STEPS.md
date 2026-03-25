# Amplify Frontend Deployment - Step by Step

Your backend is deployed at: **https://ueppzif6ym.us-east-1.awsapprunner.com**

Now let's deploy the frontend to Amplify.

## Quick Setup (5 minutes)

### Step 1: Open Amplify Console

Click this link: [AWS Amplify Console](https://console.aws.amazon.com/amplify/home?region=us-east-1#/create)

Or manually go to:
1. AWS Console → Search for "Amplify"
2. Click "Create new app" or "Host web app"

### Step 2: Connect to GitHub

1. Click **"GitHub"** as the source
2. Click **"Connect branch"**
3. Authorize AWS Amplify (one-time)
4. Select:
   - **Repository:** `matthewcarter95/connectedAccountsBot`
   - **Branch:** `main`
5. Click **"Next"**

### Step 3: Configure Build Settings

The build settings should auto-detect from `amplify.yml`:

```yaml
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build --workspace=packages/frontend
      artifacts:
        baseDirectory: packages/frontend/dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - packages/frontend/node_modules/**/*
    appRoot: packages/frontend
```

1. Review the settings (should be auto-populated)
2. Click **"Next"**

### Step 4: Review and Create

1. Review all settings
2. Click **"Save and deploy"**

### Step 5: Add Environment Variables (IMPORTANT!)

While the build is running:

1. In Amplify Console, go to **App Settings** → **Environment variables**
2. Click **"Manage variables"**
3. Add these variables:

```
VITE_AUTH0_DOMAIN=myid-selfservice.cic-demo-platform.auth0app.com
VITE_AUTH0_CLIENT_ID=KFI6neceAPPNmBJnd2YSCBN8ECvLDdpD
VITE_AUTH0_AUDIENCE=api://discordGoogleConnectedAccounts
VITE_AUTH0_REDIRECT_URI=https://main.YOUR_APP_ID.amplifyapp.com
VITE_SUPABASE_URL=https://bkzrwdoghjgbqezwkfkz.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=YOUR_SUPABASE_KEY
VITE_API_BASE_URL=https://ueppzif6ym.us-east-1.awsapprunner.com
```

**Note:** Replace `YOUR_APP_ID` in the redirect URI with your actual Amplify app ID (you'll see it in the URL)

4. Click **"Save"**
5. Go back to the deployment and **redeploy** with new environment variables

### Step 6: Update Auth0 Settings

Once your app is deployed, update Auth0:

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Go to **Applications** → Your SPA Application
3. Update:
   - **Allowed Callback URLs:** Add `https://main.YOUR_APP_ID.amplifyapp.com/callback`
   - **Allowed Logout URLs:** Add `https://main.YOUR_APP_ID.amplifyapp.com`
   - **Allowed Web Origins:** Add `https://main.YOUR_APP_ID.amplifyapp.com`
4. Click **"Save Changes"**

### Step 7: Test Your App

Visit: `https://main.YOUR_APP_ID.amplifyapp.com`

You should see your React app running and connected to your backend!

---

## Troubleshooting

### Build Fails

- Check build logs in Amplify Console
- Verify `amplify.yml` is in the repo root
- Make sure all dependencies are in `package.json`

### "Environment variables not working"

- Variables must start with `VITE_` for Vite to pick them up
- Redeploy after adding variables
- Check the build logs to see if variables are being used

### Can't authenticate

- Verify Auth0 URLs are updated
- Check redirect URI matches exactly
- Make sure VITE_AUTH0_REDIRECT_URI is set correctly

### API calls failing

- Verify VITE_API_BASE_URL is correct
- Check CORS settings in backend
- Test backend health: `curl https://ueppzif6ym.us-east-1.awsapprunner.com/api/health`

---

## Environment Variables Reference

Copy your actual values:

```bash
# From packages/frontend/.env
VITE_AUTH0_DOMAIN=myid-selfservice.cic-demo-platform.auth0app.com
VITE_AUTH0_CLIENT_ID=KFI6neceAPPNmBJnd2YSCBN8ECvLDdpD
VITE_AUTH0_AUDIENCE=api://discordGoogleConnectedAccounts

# Get this from your Amplify app URL
VITE_AUTH0_REDIRECT_URI=https://main.[YOUR_APP_ID].amplifyapp.com

# Backend API (already deployed)
VITE_API_BASE_URL=https://ueppzif6ym.us-east-1.awsapprunner.com

# From your backend .env
VITE_SUPABASE_URL=https://bkzrwdoghjgbqezwkfkz.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=[your-key]
```
