// AWS Lambda entry point — wraps the Express app with serverless-http
import serverless from 'serverless-http';
import app from './app.js';

export const handler = serverless(app, {
  // Lambda Function URL passes the full URL; strip any stage prefix if needed
  request: (request: any, event: any) => {
    // Ensure cookies are forwarded correctly from CloudFront → Lambda
    if (event.headers?.cookie) {
      request.headers.cookie = event.headers.cookie;
    }
  },
});
