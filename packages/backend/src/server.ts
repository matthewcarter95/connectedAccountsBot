// Local development and App Runner entry point
import app from './app.js';

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Auth0 Domain: ${process.env.AUTH0_DOMAIN}`);
});
