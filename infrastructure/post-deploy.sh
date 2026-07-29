#!/usr/bin/env bash
# Post-deployment script — run after the CloudFormation stack is CREATE_COMPLETE.
# Adds the Lambda Function URL (blocked in CF by org hook) and creates the
# API CloudFront distribution + Route 53 record.
set -euo pipefail

STACK_NAME="${STACK_NAME:-connected-accounts-app}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
API_DOMAIN="connectedapps-api.demo-connect.us"
FRONTEND_DOMAIN="connectedapps.demo-connect.us"
CERT_ARN="arn:aws:acm:us-east-1:204352680806:certificate/2cff1ec5-7936-49de-9c54-dd3a0c327baf"
HOSTED_ZONE_ID="Z0779465JLQ9Q597U3NC"

# ── 1. Get Lambda ARN from stack outputs ──────────────────────────────────
FUNCTION_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`BffFunctionArn`].OutputValue' \
  --output text)
echo "Lambda ARN: $FUNCTION_ARN"

# ── 2. Add Lambda Function URL (CORS allows frontend domain) ──────────────
echo "Creating Function URL..."
FUNCTION_URL=$(aws lambda create-function-url-config \
  --function-name connected-accounts-bff \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["https://'"$FRONTEND_DOMAIN"'", "http://localhost:3000"],
    "AllowHeaders": ["content-type", "cookie"],
    "AllowMethods": ["GET", "POST", "DELETE", "PUT"],
    "AllowCredentials": true,
    "MaxAge": 86400
  }' \
  --region "$REGION" \
  --query 'FunctionUrl' --output text 2>/dev/null) || true

# If already exists, fetch the existing URL
if [ -z "$FUNCTION_URL" ] || [ "$FUNCTION_URL" = "None" ]; then
  echo "Function URL already exists, fetching..."
  FUNCTION_URL=$(aws lambda get-function-url-config \
    --function-name connected-accounts-bff \
    --region "$REGION" \
    --query 'FunctionUrl' --output text)
fi

echo "Function URL: $FUNCTION_URL"

# Strip trailing slash and extract hostname for CloudFront origin
FUNCTION_URL_HOST=$(echo "$FUNCTION_URL" | sed 's|https://||' | sed 's|/||')
echo "Function URL host: $FUNCTION_URL_HOST"

# Allow public invocation via the Function URL
aws lambda add-permission \
  --function-name connected-accounts-bff \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region "$REGION" 2>/dev/null || echo "Permission already exists"

# ── 3. Create API CloudFront distribution ─────────────────────────────────
echo "Creating API CloudFront distribution..."
CF_DIST_ID=$(aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "connected-accounts-api-'"$(date +%s)"'",
    "Comment": "Connected Accounts BFF API",
    "Enabled": true,
    "Aliases": {
      "Quantity": 1,
      "Items": ["'"$API_DOMAIN"'"]
    },
    "ViewerCertificate": {
      "ACMCertificateArn": "'"$CERT_ARN"'",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021"
    },
    "Origins": {
      "Quantity": 1,
      "Items": [{
        "Id": "LambdaFunctionURL",
        "DomainName": "'"$FUNCTION_URL_HOST"'",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]}
        }
      }]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "LambdaFunctionURL",
      "ViewerProtocolPolicy": "redirect-to-https",
      "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
      "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac",
      "AllowedMethods": {
        "Quantity": 7,
        "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
        "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]}
      },
      "Compress": true
    },
    "HttpVersion": "http2"
  }' \
  --query 'Distribution.Id' --output text)

echo "API CloudFront distribution ID: $CF_DIST_ID"

# Get the CloudFront domain name for the Route 53 record
CF_DOMAIN=$(aws cloudfront get-distribution \
  --id "$CF_DIST_ID" \
  --query 'Distribution.DomainName' --output text)
echo "API CloudFront domain: $CF_DOMAIN"

# ── 4. Add Route 53 A record for API domain ───────────────────────────────
echo "Adding Route 53 record for $API_DOMAIN..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "'"$API_DOMAIN"'",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "'"$CF_DOMAIN"'",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }' --query 'ChangeInfo.Status' --output text

echo ""
echo "✅ Post-deployment complete!"
echo "   Frontend:  https://$FRONTEND_DOMAIN"
echo "   API:       https://$API_DOMAIN"
echo ""
echo "⏳ CloudFront distributions take ~10 minutes to deploy globally."
echo "   Check status: aws cloudfront get-distribution --id $CF_DIST_ID --query 'Distribution.Status'"
