#!/bin/bash

# Connected Accounts Bot - Setup Verification Script
# This script checks if your environment is properly configured

echo "🔍 Connected Accounts Bot - Setup Verification"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 is installed"
        return 0
    else
        echo -e "${RED}✗${NC} $1 is not installed"
        return 1
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 exists"
        return 0
    else
        echo -e "${RED}✗${NC} $1 is missing"
        return 1
    fi
}

check_env_var() {
    if grep -q "^$2=" "$1" 2>/dev/null; then
        value=$(grep "^$2=" "$1" | cut -d'=' -f2)
        if [ -n "$value" ] && [ "$value" != "your-" ] && [[ ! "$value" =~ ^your- ]] && [[ ! "$value" =~ ^YOUR- ]]; then
            echo -e "${GREEN}✓${NC} $2 is set in $1"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} $2 exists but needs to be configured in $1"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} $2 is missing from $1"
        return 1
    fi
}

# Check prerequisites
echo "Checking prerequisites..."
check_command node
check_command npm
check_command git
echo ""

# Check Node version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✓${NC} Node.js version is $NODE_VERSION (>= 18 required)"
    else
        echo -e "${RED}✗${NC} Node.js version is $NODE_VERSION (18+ required)"
    fi
fi
echo ""

# Check project structure
echo "Checking project structure..."
check_file "package.json"
check_file "pnpm-workspace.yaml"
check_file "packages/backend/package.json"
check_file "packages/frontend/package.json"
check_file "packages/backend/prisma/schema.prisma"
echo ""

# Check dependencies
echo "Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} Root dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Root dependencies not installed (run: npm install)"
fi

if [ -d "packages/backend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Backend dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Backend dependencies not installed (run: npm install)"
fi

if [ -d "packages/frontend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Frontend dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Frontend dependencies not installed (run: npm install)"
fi
echo ""

# Check environment files
echo "Checking environment configuration..."
BACKEND_ENV="packages/backend/.env"
FRONTEND_ENV="packages/frontend/.env"

if [ -f "$BACKEND_ENV" ]; then
    echo -e "${GREEN}✓${NC} Backend .env file exists"
    check_env_var "$BACKEND_ENV" "AUTH0_DOMAIN"
    check_env_var "$BACKEND_ENV" "AUTH0_API_CLIENT_ID"
    check_env_var "$BACKEND_ENV" "AUTH0_API_CLIENT_SECRET"
    check_env_var "$BACKEND_ENV" "DATABASE_URL"
    check_env_var "$BACKEND_ENV" "OPENAI_API_KEY"
else
    echo -e "${RED}✗${NC} Backend .env file missing (copy from .env.example)"
fi
echo ""

if [ -f "$FRONTEND_ENV" ]; then
    echo -e "${GREEN}✓${NC} Frontend .env file exists"
    check_env_var "$FRONTEND_ENV" "VITE_AUTH0_DOMAIN"
    check_env_var "$FRONTEND_ENV" "VITE_AUTH0_CLIENT_ID"
    check_env_var "$FRONTEND_ENV" "VITE_SUPABASE_URL"
    check_env_var "$FRONTEND_ENV" "VITE_SUPABASE_PUBLISHABLE_KEY"
else
    echo -e "${RED}✗${NC} Frontend .env file missing (copy from .env.example)"
fi
echo ""

# Check Prisma
echo "Checking database setup..."
if [ -d "packages/backend/node_modules/.prisma" ]; then
    echo -e "${GREEN}✓${NC} Prisma client generated"
else
    echo -e "${YELLOW}⚠${NC} Prisma client not generated (run: cd packages/backend && npm run prisma:generate)"
fi

if [ -d "packages/backend/prisma/migrations" ]; then
    echo -e "${GREEN}✓${NC} Database migrations created"
else
    echo -e "${YELLOW}⚠${NC} No migrations found (run: cd packages/backend && npm run prisma:migrate)"
fi
echo ""

# Summary
echo "================================================"
echo "Setup verification complete!"
echo ""
echo "Next steps:"
echo "1. If any items are marked with ✗ or ⚠, fix them first"
echo "2. Run 'npm install' from the root directory"
echo "3. Configure .env files for backend and frontend"
echo "4. Run 'cd packages/backend && npm run prisma:migrate'"
echo "5. Start backend: cd packages/backend && npm run dev"
echo "6. Start frontend: cd packages/frontend && npm run dev"
echo ""
echo "See SETUP_GUIDE.md for detailed instructions"
