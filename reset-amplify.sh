#!/bin/bash

# Delete the Amplify app and start fresh with just hosting

set -e

APP_ID="d2azfcu9x00wkt"
REGION="us-east-1"

echo "🗑️  Deleting Amplify app (to start fresh)..."
aws amplify delete-app --app-id "$APP_ID" --region "$REGION"

echo "✅ App deleted. Run this to create a new clean one:"
echo ""
echo "aws amplify create-app --name connected-accounts-bot --platform WEB --region us-east-1"
echo ""
echo "Then go to the console and connect GitHub (SKIP all backend/studio options)"
